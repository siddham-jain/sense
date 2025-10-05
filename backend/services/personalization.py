"""
Sense Personalization Engine
=============================
Combines user interests, knowledge graph anchors, and browsing patterns
to generate highly personalized content recommendations.
"""

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class PersonalizationProfile:
    """User's personalization profile combining all data sources."""
    user_id: str
    interests: List[Dict[str, Any]] = field(default_factory=list)
    anchors: List[Dict[str, Any]] = field(default_factory=list)
    browsing_domains: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    
    def get_top_topics(self, limit: int = 10) -> List[str]:
        """Get top topics from all sources, weighted and deduplicated."""
        topic_scores = {}
        
        # Interests have highest weight (user explicitly chose them)
        for interest in self.interests:
            topic = interest.get('topic_name', '').lower()
            if topic:
                topic_scores[topic] = topic_scores.get(topic, 0) + 10
        
        # Knowledge graph anchors
        for anchor in self.anchors:
            label = anchor.get('label', '').lower()
            freq = anchor.get('frequency', 1)
            if label:
                topic_scores[label] = topic_scores.get(label, 0) + (freq * 2)
        
        # Keywords from browsing
        for kw in self.keywords:
            kw_lower = kw.lower()
            topic_scores[kw_lower] = topic_scores.get(kw_lower, 0) + 1
        
        # Sort by score and return top topics
        sorted_topics = sorted(topic_scores.items(), key=lambda x: x[1], reverse=True)
        return [t[0] for t in sorted_topics[:limit]]
    
    def get_search_queries(self, count: int = 5) -> List[str]:
        """Generate search queries for content discovery."""
        topics = self.get_top_topics(count * 2)
        queries = []
        
        # Combine topics into meaningful search queries
        for i, topic in enumerate(topics[:count]):
            # Add context modifiers for better search results
            modifiers = ['explained', 'how', 'guide', 'learn', 'tips']
            modifier = modifiers[i % len(modifiers)]
            queries.append(f"{topic} {modifier}")
        
        return queries
    
    def is_empty(self) -> bool:
        """Check if user has any personalization data."""
        return not self.interests and not self.anchors and not self.keywords


class PersonalizationEngine:
    """
    Engine for building user personalization profiles and 
    generating content recommendations.
    """
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
    async def get_user_profile(self, user_id: str) -> PersonalizationProfile:
        """Build complete personalization profile for a user."""
        profile = PersonalizationProfile(user_id=user_id)
        
        # Fetch user interests
        try:
            result = self.supabase.table('interests') \
                .select('*') \
                .eq('user_id', user_id) \
                .execute()
            profile.interests = result.data or []
            logger.info(f"Found {len(profile.interests)} interests for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to fetch interests: {e}")
        
        # Fetch knowledge graph anchors (nodes)
        try:
            result = self.supabase.table('knowledge_graph_nodes') \
                .select('*') \
                .eq('user_id', user_id) \
                .order('frequency', desc=True) \
                .limit(50) \
                .execute()
            profile.anchors = result.data or []
            logger.info(f"Found {len(profile.anchors)} anchors for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to fetch anchors: {e}")
        
        # Extract keywords from anchors
        for anchor in profile.anchors:
            label = anchor.get('label', '')
            if label and len(label) > 2:
                profile.keywords.append(label)
        
        # Fetch browsing history domains (if available)
        try:
            result = self.supabase.table('browsing_history') \
                .select('domain') \
                .eq('user_id', user_id) \
                .limit(100) \
                .execute()
            domains = set()
            for entry in (result.data or []):
                domain = entry.get('domain', '')
                if domain:
                    domains.add(domain)
            profile.browsing_domains = list(domains)
        except Exception as e:
            logger.debug(f"Browsing history not available: {e}")
        
        return profile
    
    def generate_video_prompts(self, profile: PersonalizationProfile, count: int = 3) -> List[Dict[str, Any]]:
        """Generate video prompts based on user's personalization profile."""
        topics = profile.get_top_topics(count * 2)
        prompts = []
        
        # Infotainment video prompt templates
        templates = [
            {
                "style": "explainer",
                "template": "A visually stunning explainer video about {topic}. Clean modern graphics with warm amber accents on dark background. Smooth camera movements, elegant typography overlays, professional documentary style. 10 seconds.",
                "title_template": "Understanding {topic}",
            },
            {
                "style": "visual_journey",
                "template": "A cinematic visual journey exploring {topic}. Abstract representations with flowing particles and soft golden light. Atmospheric and contemplative mood. Premium production quality. 10 seconds.",
                "title_template": "Exploring {topic}",
            },
            {
                "style": "data_viz",
                "template": "An elegant data visualization about {topic}. Minimalist design with subtle animations, dark theme with warm gold highlights. Information flowing like liquid gold. 10 seconds.",
                "title_template": "{topic} Visualized",
            },
            {
                "style": "concept",
                "template": "Abstract concept visualization of {topic}. Geometric shapes morphing and connecting in 3D space. Warm lighting on dark void. Philosophical and thought-provoking. 10 seconds.",
                "title_template": "The Essence of {topic}",
            }
        ]
        
        for i, topic in enumerate(topics[:count]):
            template = templates[i % len(templates)]
            prompts.append({
                "topic": topic.title(),
                "prompt": template["template"].format(topic=topic),
                "title": template["title_template"].format(topic=topic.title()),
                "description": f"AI-generated visual exploration of {topic}, personalized for your interests.",
                "style": template["style"]
            })
        
        return prompts
    
    def get_youtube_search_queries(self, profile: PersonalizationProfile, count: int = 5) -> List[str]:
        """Generate YouTube search queries for Shorts discovery."""
        topics = profile.get_top_topics(count)
        queries = []
        
        # Generate search queries optimized for YouTube Shorts
        modifiers = [
            "#shorts explained",
            "#shorts facts",
            "#shorts quick guide",
            "#shorts tips",
            "#shorts learn"
        ]
        
        for i, topic in enumerate(topics):
            modifier = modifiers[i % len(modifiers)]
            queries.append(f"{topic} {modifier}")
        
        return queries
