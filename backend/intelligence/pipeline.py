"""
Sense Intelligence Pipeline
============================
Two-layer pipeline for knowledge graph generation:
1. NLP Layer: Deterministic extraction of entities, keyphrases, frequency/recency analysis
2. LLM Layer: Semantic clustering, relationship inference, abstraction
"""

import os
import json
import uuid
import logging
import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter, defaultdict
from dataclasses import dataclass, field, asdict

import spacy
import yake
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# ============================================
# Data Models
# ============================================

@dataclass
class Anchor:
    """A stabilized concept extracted from browsing history."""
    text: str
    anchor_type: str  # entity, phrase, domain
    frequency: int = 1
    recency_score: float = 1.0
    sources: List[str] = field(default_factory=list)  # List of URLs
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class GraphNode:
    """A node in the knowledge graph."""
    id: str
    label: str
    kind: str  # entity, phrase, abstract, domain
    frequency: int = 1
    attrs: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 1.0
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass 
class GraphEdge:
    """An edge in the knowledge graph."""
    id: str
    source_label: str
    target_label: str
    relation: str  # related_to, influences, part_of, contrasts, etc.
    weight: float = 1.0
    confidence: float = 1.0
    attrs: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class NLPLayer:
    """
    Deterministic NLP layer for signal grounding.
    Performs: NER, keyphrase extraction, frequency/recency analysis, normalization.
    """
    
    def __init__(self):
        # Load spaCy model
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy model not found, downloading...")
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"])
            self.nlp = spacy.load("en_core_web_sm")
        
        # YAKE keyword extractor
        self.kw_extractor = yake.KeywordExtractor(
            lan="en",
            n=3,  # Max n-gram size
            dedupLim=0.7,
            dedupFunc='seqm',
            windowsSize=2,
            top=20,
            features=None
        )
        
        # Stop words and common phrases to filter
        self.stop_entities = {
            'today', 'yesterday', 'tomorrow', 'monday', 'tuesday', 'wednesday',
            'thursday', 'friday', 'saturday', 'sunday', 'january', 'february',
            'march', 'april', 'may', 'june', 'july', 'august', 'september',
            'october', 'november', 'december', 'http', 'https', 'www', 'com',
            'org', 'net', 'the', 'this', 'that', 'here', 'there'
        }
    
    def extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extract named entities using spaCy NER."""
        doc = self.nlp(text[:50000])  # Limit text length
        entities = []
        seen = set()
        
        for ent in doc.ents:
            # Filter by entity types we care about
            if ent.label_ in {'PERSON', 'ORG', 'GPE', 'PRODUCT', 'WORK_OF_ART', 
                              'EVENT', 'LAW', 'NORP', 'FAC', 'LOC'}:
                text_normalized = ent.text.strip().lower()
                
                # Skip if too short, too long, or a stop entity
                if (len(text_normalized) < 2 or 
                    len(text_normalized) > 50 or
                    text_normalized in self.stop_entities or
                    text_normalized in seen):
                    continue
                
                seen.add(text_normalized)
                entities.append({
                    'text': ent.text.strip(),
                    'type': ent.label_,
                    'normalized': text_normalized
                })
        
        return entities[:30]  # Limit entities per document
    
    def extract_keyphrases(self, text: str) -> List[str]:
        """Extract keyphrases using YAKE."""
        keywords = self.kw_extractor.extract_keywords(text[:10000])
        
        # Filter and normalize
        phrases = []
        seen = set()
        
        for kw, score in keywords:
            normalized = kw.strip().lower()
            # Skip if too short, numeric, or duplicate
            if (len(normalized) < 3 or 
                normalized.replace(' ', '').isdigit() or
                normalized in seen or
                normalized in self.stop_entities):
                continue
            
            seen.add(normalized)
            phrases.append(normalized)
        
        return phrases[:15]
    
    def calculate_recency_score(self, timestamp: datetime, now: datetime, 
                                 half_life_days: float = 7.0) -> float:
        """
        Calculate recency score using exponential decay.
        More recent = higher score (0-1).
        """
        age_days = (now - timestamp).total_seconds() / 86400
        decay = math.exp(-0.693 * age_days / half_life_days)  # 0.693 = ln(2)
        return min(1.0, max(0.0, decay))
    
    def extract_anchors(self, browsing_history: List[Dict[str, Any]], 
                        days: int = 30) -> List[Anchor]:
        """
        Process browsing history and extract stabilized anchors.
        
        Args:
            browsing_history: List of browsing history entries from Supabase
            days: Time window in days
            
        Returns:
            List of Anchor objects with frequency and recency scores
        """
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=days)
        
        # Aggregate counters
        entity_data = defaultdict(lambda: {
            'count': 0, 'recency_sum': 0.0, 'sources': set(),
            'first_seen': None, 'last_seen': None, 'original_text': None
        })
        phrase_data = defaultdict(lambda: {
            'count': 0, 'recency_sum': 0.0, 'sources': set(),
            'first_seen': None, 'last_seen': None
        })
        domain_data = defaultdict(lambda: {
            'count': 0, 'recency_sum': 0.0, 'dwell_total': 0,
            'first_seen': None, 'last_seen': None
        })
        
        for entry in browsing_history:
            # Parse timestamp
            created_at = entry.get('created_at')
            if isinstance(created_at, str):
                try:
                    timestamp = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                except:
                    timestamp = now
            else:
                timestamp = now
            
            # Skip if outside time window
            if timestamp < cutoff:
                continue
            
            recency = self.calculate_recency_score(timestamp, now)
            url = entry.get('url', '')
            domain = entry.get('domain', '')
            dwell_ms = entry.get('dwell_ms', 0) or 0
            
            # Process existing entities from extension
            for ent in (entry.get('entities') or []):
                text = ent.get('text', ent) if isinstance(ent, dict) else str(ent)
                normalized = text.strip().lower()
                if len(normalized) >= 2 and normalized not in self.stop_entities:
                    data = entity_data[normalized]
                    data['count'] += 1
                    data['recency_sum'] += recency
                    data['sources'].add(url)
                    if data['original_text'] is None:
                        data['original_text'] = text.strip()
                    if data['first_seen'] is None or timestamp.isoformat() < data['first_seen']:
                        data['first_seen'] = timestamp.isoformat()
                    if data['last_seen'] is None or timestamp.isoformat() > data['last_seen']:
                        data['last_seen'] = timestamp.isoformat()
            
            # Process existing keyphrases from extension
            for phrase in (entry.get('keyphrases') or []):
                normalized = str(phrase).strip().lower()
                if len(normalized) >= 3 and normalized not in self.stop_entities:
                    data = phrase_data[normalized]
                    data['count'] += 1
                    data['recency_sum'] += recency
                    data['sources'].add(url)
                    if data['first_seen'] is None or timestamp.isoformat() < data['first_seen']:
                        data['first_seen'] = timestamp.isoformat()
                    if data['last_seen'] is None or timestamp.isoformat() > data['last_seen']:
                        data['last_seen'] = timestamp.isoformat()
            
            # Process content for additional extraction
            content = entry.get('content', {})
            text_content = content.get('text', '') if isinstance(content, dict) else ''
            title = entry.get('title', '')
            
            combined_text = f"{title} {text_content}"
            if len(combined_text) > 100:
                # Extract additional entities
                for ent in self.extract_entities(combined_text):
                    normalized = ent['normalized']
                    data = entity_data[normalized]
                    data['count'] += 1
                    data['recency_sum'] += recency
                    data['sources'].add(url)
                    if data['original_text'] is None:
                        data['original_text'] = ent['text']
                
                # Extract additional keyphrases
                for phrase in self.extract_keyphrases(combined_text):
                    data = phrase_data[phrase]
                    data['count'] += 1
                    data['recency_sum'] += recency
                    data['sources'].add(url)
            
            # Track domains
            if domain:
                clean_domain = domain.replace('www.', '').lower()
                data = domain_data[clean_domain]
                data['count'] += 1
                data['recency_sum'] += recency
                data['dwell_total'] += dwell_ms
                if data['first_seen'] is None or timestamp.isoformat() < data['first_seen']:
                    data['first_seen'] = timestamp.isoformat()
                if data['last_seen'] is None or timestamp.isoformat() > data['last_seen']:
                    data['last_seen'] = timestamp.isoformat()
        
        # Convert to Anchor objects
        anchors = []
        
        # Entities
        for normalized, data in entity_data.items():
            if data['count'] >= 1:
                anchors.append(Anchor(
                    text=data['original_text'] or normalized.title(),
                    anchor_type='entity',
                    frequency=data['count'],
                    recency_score=data['recency_sum'] / max(1, data['count']),
                    sources=list(data['sources'])[:10],
                    first_seen=data['first_seen'],
                    last_seen=data['last_seen']
                ))
        
        # Phrases
        for phrase, data in phrase_data.items():
            if data['count'] >= 1:
                anchors.append(Anchor(
                    text=phrase,
                    anchor_type='phrase',
                    frequency=data['count'],
                    recency_score=data['recency_sum'] / max(1, data['count']),
                    sources=list(data['sources'])[:10],
                    first_seen=data['first_seen'],
                    last_seen=data['last_seen']
                ))
        
        # Domains (top ones only)
        for domain, data in sorted(domain_data.items(), 
                                   key=lambda x: x[1]['count'], reverse=True)[:20]:
            if data['count'] >= 2:  # At least 2 visits
                anchors.append(Anchor(
                    text=domain,
                    anchor_type='domain',
                    frequency=data['count'],
                    recency_score=data['recency_sum'] / max(1, data['count']),
                    sources=[],
                    first_seen=data['first_seen'],
                    last_seen=data['last_seen']
                ))
        
        # Sort by combined score (frequency * recency)
        anchors.sort(key=lambda a: a.frequency * a.recency_score, reverse=True)
        
        logger.info(f"Extracted {len(anchors)} anchors: "
                    f"{sum(1 for a in anchors if a.anchor_type == 'entity')} entities, "
                    f"{sum(1 for a in anchors if a.anchor_type == 'phrase')} phrases, "
                    f"{sum(1 for a in anchors if a.anchor_type == 'domain')} domains")
        
        return anchors[:100]  # Return top 100 anchors


class LLMLayer:
    """
    LLM layer for semantic clustering and relationship inference.
    Uses constrained prompting to output strict JSON schema.
    """
    
    def __init__(self):
        self.api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not self.api_key:
            raise ValueError("EMERGENT_LLM_KEY not found in environment")
    
    async def generate_graph(self, anchors: List[Anchor], 
                              user_interests: List[str] = None) -> Dict[str, Any]:
        """
        Generate knowledge graph from anchors using LLM.
        
        Args:
            anchors: List of stabilized anchors from NLP layer
            user_interests: Optional list of user's interests for context
            
        Returns:
            Dict with 'nodes' and 'edges' arrays
        """
        # from openai import AsyncOpenAI
        # client = AsyncOpenAI(api_key=self.api_key)
        
        # Prepare anchor summary for prompt
        anchor_summary = self._prepare_anchor_summary(anchors)
        interests_context = ""
        if user_interests:
            interests_context = f"\nUser's areas of interest: {', '.join(user_interests)}\n"
        
        system_prompt = """You are a knowledge graph architect. Your task is to analyze concepts and create a semantic knowledge graph.

You MUST respond with ONLY valid JSON, no markdown, no explanation. The JSON must follow this exact schema:
{
  "nodes": [
    {"label": "string", "kind": "entity|phrase|abstract|domain", "confidence": 0.0-1.0}
  ],
  "edges": [
    {"source": "label1", "target": "label2", "relation": "string", "weight": 0.0-1.0, "confidence": 0.0-1.0}
  ]
}

Relation types to use: "related_to", "influences", "part_of", "contrasts_with", "enables", "derives_from", "similar_to"

Guidelines:
- Create 10-30 nodes from the most significant concepts
- Create meaningful edges between related concepts (aim for 15-50 edges)
- Add 2-5 "abstract" nodes that represent higher-level themes
- Confidence reflects how certain you are about the node/relationship
- Weight reflects strength of the relationship
- Labels should be clean, readable, and capitalized appropriately"""

        user_prompt = f"""Analyze these concepts extracted from a user's browsing history and create a knowledge graph:
{interests_context}
{anchor_summary}

Respond with ONLY the JSON object, no other text."""

        try:
            # Mocking the LLM call for now as we've removed emergentintegrations
            # In a real scenario, this would use the openai library directly:
            # response = await client.chat.completions.create(
            #     model="gpt-4",
            #     messages=[
            #         {"role": "system", "content": system_prompt},
            #         {"role": "user", "content": user_prompt}
            #     ]
            # )
            # response_text = response.choices[0].message.content
            
            # For now, we'll trigger the fallback or use a simple logic if we had keys
            raise Exception("LLM connection needs to be reconfigured")
            
            # Parse JSON response
            graph_data = self._parse_llm_response(response)
            
            # Validate and enhance with anchor data
            graph_data = self._enhance_graph(graph_data, anchors)
            
            logger.info(f"LLM generated graph: {len(graph_data['nodes'])} nodes, "
                        f"{len(graph_data['edges'])} edges")
            
            return graph_data
            
        except Exception as e:
            logger.error(f"LLM graph generation failed: {e}")
            # Fallback to simple graph from anchors
            return self._fallback_graph(anchors)
    
    def _prepare_anchor_summary(self, anchors: List[Anchor]) -> str:
        """Prepare a concise summary of anchors for the LLM prompt."""
        lines = []
        
        # Group by type
        entities = [a for a in anchors if a.anchor_type == 'entity'][:25]
        phrases = [a for a in anchors if a.anchor_type == 'phrase'][:20]
        domains = [a for a in anchors if a.anchor_type == 'domain'][:10]
        
        if entities:
            lines.append("ENTITIES (named things):")
            for a in entities:
                lines.append(f"  - {a.text} (frequency: {a.frequency}, recency: {a.recency_score:.2f})")
        
        if phrases:
            lines.append("\nKEY PHRASES (concepts/topics):")
            for a in phrases:
                lines.append(f"  - {a.text} (frequency: {a.frequency})")
        
        if domains:
            lines.append("\nFREQUENT DOMAINS (websites visited):")
            for a in domains:
                lines.append(f"  - {a.text} (visits: {a.frequency})")
        
        return "\n".join(lines)
    
    def _parse_llm_response(self, response: str) -> Dict[str, Any]:
        """Parse and validate LLM JSON response."""
        # Clean response - remove markdown if present
        response = response.strip()
        if response.startswith('```'):
            lines = response.split('\n')
            # Remove first and last lines if they're markdown delimiters
            if lines[0].startswith('```'):
                lines = lines[1:]
            if lines and lines[-1].startswith('```'):
                lines = lines[:-1]
            response = '\n'.join(lines)
        
        try:
            data = json.loads(response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            raise ValueError(f"Invalid JSON from LLM: {e}")
        
        # Validate structure
        if not isinstance(data, dict):
            raise ValueError("LLM response is not a JSON object")
        if 'nodes' not in data or 'edges' not in data:
            raise ValueError("LLM response missing 'nodes' or 'edges'")
        if not isinstance(data['nodes'], list) or not isinstance(data['edges'], list):
            raise ValueError("'nodes' and 'edges' must be arrays")
        
        return data
    
    def _enhance_graph(self, graph_data: Dict[str, Any], 
                       anchors: List[Anchor]) -> Dict[str, Any]:
        """Enhance graph with frequency data from anchors."""
        # Build anchor lookup
        anchor_lookup = {a.text.lower(): a for a in anchors}
        
        # Enhance nodes with frequency
        for node in graph_data['nodes']:
            label_lower = node['label'].lower()
            if label_lower in anchor_lookup:
                anchor = anchor_lookup[label_lower]
                node['frequency'] = anchor.frequency
                node['recency_score'] = anchor.recency_score
            else:
                node['frequency'] = 1
                node['recency_score'] = 0.5
        
        return graph_data
    
    def _fallback_graph(self, anchors: List[Anchor]) -> Dict[str, Any]:
        """Generate a simple graph from anchors when LLM fails."""
        nodes = []
        edges = []
        
        # Top anchors become nodes
        top_anchors = sorted(anchors, 
                            key=lambda a: a.frequency * a.recency_score, 
                            reverse=True)[:30]
        
        for anchor in top_anchors:
            nodes.append({
                'label': anchor.text,
                'kind': anchor.anchor_type,
                'frequency': anchor.frequency,
                'confidence': min(1.0, anchor.recency_score)
            })
        
        # Create edges between nodes that share sources
        for i, a1 in enumerate(top_anchors):
            for a2 in top_anchors[i+1:]:
                shared = set(a1.sources) & set(a2.sources)
                if len(shared) >= 1:
                    edges.append({
                        'source': a1.text,
                        'target': a2.text,
                        'relation': 'related_to',
                        'weight': min(1.0, len(shared) / 5),
                        'confidence': 0.5
                    })
        
        return {'nodes': nodes, 'edges': edges[:50]}


class IntelligencePipeline:
    """
    Main pipeline orchestrator.
    Combines NLP and LLM layers to generate knowledge graphs.
    """
    
    def __init__(self):
        self.nlp_layer = NLPLayer()
        self.llm_layer = LLMLayer()
    
    async def generate_graph(self, browsing_history: List[Dict[str, Any]],
                              user_interests: List[str] = None,
                              days: int = 30,
                              use_llm: bool = True) -> Dict[str, Any]:
        """
        Full pipeline: browsing history -> anchors -> knowledge graph.
        
        Args:
            browsing_history: Raw browsing history from Supabase
            user_interests: User's selected interests
            days: Time window for analysis
            use_llm: Whether to use LLM for semantic graph (vs simple aggregation)
            
        Returns:
            Dict with 'anchors', 'nodes', 'edges', and 'stats'
        """
        # Step 1: NLP Layer - Extract anchors
        logger.info(f"Processing {len(browsing_history)} browsing entries...")
        anchors = self.nlp_layer.extract_anchors(browsing_history, days=days)
        
        if not anchors:
            logger.warning("No anchors extracted from browsing history")
            return {
                'anchors': [],
                'nodes': [],
                'edges': [],
                'stats': {'anchors': 0, 'nodes': 0, 'edges': 0, 'llm_used': False}
            }
        
        # Step 2: LLM Layer - Generate semantic graph
        if use_llm and len(anchors) >= 3:
            try:
                graph_data = await self.llm_layer.generate_graph(anchors, user_interests)
            except Exception as e:
                logger.error(f"LLM layer failed, using fallback: {e}")
                graph_data = self.llm_layer._fallback_graph(anchors)
        else:
            # Fallback for too few anchors
            graph_data = self.llm_layer._fallback_graph(anchors)
        
        return {
            'anchors': [a.to_dict() for a in anchors],
            'nodes': graph_data['nodes'],
            'edges': graph_data['edges'],
            'stats': {
                'anchors': len(anchors),
                'nodes': len(graph_data['nodes']),
                'edges': len(graph_data['edges']),
                'llm_used': use_llm and len(anchors) >= 3
            }
        }
