from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from supabase import create_client, Client
import httpx
from intelligence.pipeline import IntelligencePipeline

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection (keeping for backward compatibility)
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
mongo_client = AsyncIOMotorClient(mongo_url)
mongo_db = mongo_client[os.environ.get('DB_NAME', 'test_database')]

# Supabase connection
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY')

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Create the main app
app = FastAPI(title="Sense API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================
# Pydantic Models
# ============================================

class VideoBase(BaseModel):
    title: str
    description: Optional[str] = None
    src: str
    thumbnail_url: Optional[str] = None
    duration_ms: Optional[int] = None
    provider: str = "seeded"
    topics: List[str] = []
    meta: Dict[str, Any] = {}

class VideoCreate(VideoBase):
    pass

class Video(VideoBase):
    id: str
    is_active: bool = True
    created_at: datetime

class InterestCreate(BaseModel):
    topic_slug: str
    topic_name: str
    weight: float = 1.0

class FeedInteractionCreate(BaseModel):
    video_id: str
    action: str  # like, dislike, save, share
    value: Dict[str, Any] = {}

class GraphDataResponse(BaseModel):
    nodes: List[Dict[str, Any]]
    links: List[Dict[str, Any]]

# ============================================
# Auth Helper
# ============================================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and get user from Supabase"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Verify token with Supabase
        token = credentials.credentials
        user = supabase.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user.user
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication")

async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get user if authenticated, None otherwise"""
    if not credentials:
        return None
    try:
        token = credentials.credentials
        user = supabase.auth.get_user(token)
        return user.user if user else None
    except:
        return None

# ============================================
# API Routes
# ============================================

@api_router.get("/")
async def root():
    return {"message": "Sense API v1.0", "status": "healthy"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "supabase": bool(SUPABASE_URL)}

# ============================================
# Videos API
# ============================================

@api_router.get("/videos", response_model=List[Video])
async def get_videos(
    limit: int = 50,
    offset: int = 0,
    topic: Optional[str] = None
):
    """Get active videos, optionally filtered by topic"""
    try:
        query = supabase.table('videos').select('*').eq('is_active', True)
        
        if topic:
            query = query.contains('topics', [topic])
        
        result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        return result.data or []
    except Exception as e:
        logger.error(f"Failed to fetch videos: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch videos")

@api_router.post("/videos", response_model=Video)
async def create_video(video: VideoCreate, user = Depends(get_current_user)):
    """Create a new video (requires authentication)"""
    try:
        video_data = video.model_dump()
        video_data['id'] = str(uuid.uuid4())
        video_data['created_at'] = datetime.now(timezone.utc).isoformat()
        video_data['is_active'] = True
        
        result = supabase.table('videos').insert(video_data).execute()
        return result.data[0]
    except Exception as e:
        logger.error(f"Failed to create video: {e}")
        raise HTTPException(status_code=500, detail="Failed to create video")

# ============================================
# Feed API
# ============================================

@api_router.get("/feed")
async def get_basic_feed(
    limit: int = 20,
    offset: int = 0,
    user = Depends(get_optional_user)
):
    """Get basic video feed (legacy endpoint for backward compatibility)"""
    try:
        # Get all active videos
        videos_result = supabase.table('videos').select('*').eq('is_active', True).execute()
        videos = videos_result.data or []
        
        if not user:
            # Return all videos for non-authenticated users
            return videos[offset:offset + limit]
        
        # Get user interests
        interests_result = supabase.table('interests').select('topic_slug, weight').eq('user_id', user.id).execute()
        interests = {i['topic_slug']: i['weight'] for i in (interests_result.data or [])}
        
        # Score videos based on interest match
        scored_videos = []
        for video in videos:
            score = 0
            video_topics = video.get('topics', [])
            for topic in video_topics:
                topic_lower = topic.lower()
                for interest_slug, weight in interests.items():
                    if interest_slug in topic_lower or topic_lower in interest_slug:
                        score += weight
            scored_videos.append((score, video))
        
        # Sort by score (highest first), then by created_at
        scored_videos.sort(key=lambda x: (-x[0], x[1].get('created_at', '')), reverse=False)
        
        # Return paginated results
        result_videos = [v for _, v in scored_videos][offset:offset + limit]
        return result_videos
        
    except Exception as e:
        logger.error(f"Failed to get feed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get feed")

@api_router.post("/feed/interactions")
async def create_interaction(
    interaction: FeedInteractionCreate,
    user = Depends(get_current_user)
):
    """Record a feed interaction (like, dislike, save, share)"""
    try:
        data = {
            'id': str(uuid.uuid4()),
            'user_id': user.id,
            'video_id': interaction.video_id,
            'action': interaction.action,
            'value': interaction.value,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        result = supabase.table('feed_interactions').insert(data).execute()
        return {"success": True, "interaction_id": data['id']}
    except Exception as e:
        logger.error(f"Failed to create interaction: {e}")
        raise HTTPException(status_code=500, detail="Failed to record interaction")

@api_router.get("/feed/interactions")
async def get_user_interactions(user = Depends(get_current_user)):
    """Get all interactions for the current user"""
    try:
        result = supabase.table('feed_interactions').select('*').eq('user_id', user.id).execute()
        return result.data or []
    except Exception as e:
        logger.error(f"Failed to get interactions: {e}")
        raise HTTPException(status_code=500, detail="Failed to get interactions")

# ============================================
# Interests API
# ============================================

@api_router.get("/interests")
async def get_interests(user = Depends(get_current_user)):
    """Get user's interests"""
    try:
        result = supabase.table('interests').select('*').eq('user_id', user.id).execute()
        return result.data or []
    except Exception as e:
        logger.error(f"Failed to get interests: {e}")
        raise HTTPException(status_code=500, detail="Failed to get interests")

@api_router.post("/interests")
async def save_interests(interests: List[InterestCreate], user = Depends(get_current_user)):
    """Save user's interests (replaces existing)"""
    try:
        # Delete existing interests
        supabase.table('interests').delete().eq('user_id', user.id).execute()
        
        # Insert new interests
        if interests:
            data = [{
                'id': str(uuid.uuid4()),
                'user_id': user.id,
                'topic_slug': i.topic_slug,
                'topic_name': i.topic_name,
                'weight': i.weight,
                'created_at': datetime.now(timezone.utc).isoformat()
            } for i in interests]
            
            supabase.table('interests').insert(data).execute()
        
        return {"success": True, "count": len(interests)}
    except Exception as e:
        logger.error(f"Failed to save interests: {e}")
        raise HTTPException(status_code=500, detail="Failed to save interests")

# ============================================
# Knowledge Graph API
# ============================================

# Initialize intelligence pipeline (lazy)
_pipeline = None

def get_pipeline():
    global _pipeline
    if _pipeline is None:
        _pipeline = IntelligencePipeline()
    return _pipeline

@api_router.post("/graph/generate")
async def generate_graph(
    days: int = 30,
    use_llm: bool = True,
    user = Depends(get_current_user)
):
    """
    Generate knowledge graph from browsing history using NLP + LLM pipeline.
    This processes browsing data, extracts anchors, and creates semantic relationships.
    """
    try:
        from datetime import timedelta
        date_threshold = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        
        # Fetch browsing history
        history_result = supabase.table('browsing_history') \
            .select('*') \
            .eq('user_id', user.id) \
            .gte('created_at', date_threshold) \
            .order('created_at', desc=True) \
            .limit(500) \
            .execute()
        
        history = history_result.data or []
        
        if not history:
            return {
                'success': True,
                'message': 'No browsing history found',
                'stats': {'anchors': 0, 'nodes': 0, 'edges': 0}
            }
        
        # Fetch user interests for context
        interests_result = supabase.table('interests') \
            .select('topic_name') \
            .eq('user_id', user.id) \
            .execute()
        user_interests = [i['topic_name'] for i in (interests_result.data or [])]
        
        # Run the intelligence pipeline
        pipeline = get_pipeline()
        result = await pipeline.generate_graph(
            browsing_history=history,
            user_interests=user_interests,
            days=days,
            use_llm=use_llm
        )
        
        # Persist to database
        nodes = result['nodes']
        edges = result['edges']
        
        # Clear existing graph data for user
        supabase.table('knowledge_graph_edges').delete().eq('user_id', user.id).execute()
        supabase.table('knowledge_graph_nodes').delete().eq('user_id', user.id).execute()
        
        # Insert nodes
        node_records = []
        node_id_map = {}  # label -> uuid
        for node in nodes:
            node_id = str(uuid.uuid4())
            node_id_map[node['label']] = node_id
            node_records.append({
                'id': node_id,
                'user_id': user.id,
                'label': node['label'],
                'kind': node.get('kind', 'entity'),
                'frequency': node.get('frequency', 1),
                'attrs': {
                    'confidence': node.get('confidence', 1.0),
                    'recency_score': node.get('recency_score', 0.5)
                },
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat()
            })
        
        if node_records:
            supabase.table('knowledge_graph_nodes').insert(node_records).execute()
        
        # Insert edges
        edge_records = []
        for edge in edges:
            source_id = node_id_map.get(edge['source'])
            target_id = node_id_map.get(edge['target'])
            if source_id and target_id:
                edge_records.append({
                    'id': str(uuid.uuid4()),
                    'user_id': user.id,
                    'source_id': source_id,
                    'target_id': target_id,
                    'relation': edge.get('relation', 'related_to'),
                    'weight': edge.get('weight', 1.0),
                    'attrs': {
                        'confidence': edge.get('confidence', 1.0)
                    },
                    'created_at': datetime.now(timezone.utc).isoformat()
                })
        
        if edge_records:
            supabase.table('knowledge_graph_edges').insert(edge_records).execute()
        
        # Also store anchors for audit
        anchors = result.get('anchors', [])
        if anchors:
            # Clear and insert anchors
            supabase.table('anchors').delete().eq('user_id', user.id).execute()
            anchor_records = [{
                'id': str(uuid.uuid4()),
                'user_id': user.id,
                'anchor': a['text'],
                'anchor_type': a['anchor_type'],
                'frequency': a['frequency'],
                'recency_score': a['recency_score'],
                'sources': a.get('sources', [])[:5],
                'stats': {},
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat()
            } for a in anchors[:50]]
            supabase.table('anchors').insert(anchor_records).execute()
        
        return {
            'success': True,
            'message': 'Graph generated successfully',
            'stats': result['stats'],
            'node_count': len(nodes),
            'edge_count': len(edges)
        }
        
    except Exception as e:
        logger.error(f"Failed to generate graph: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate graph: {str(e)}")

@api_router.get("/graph/data")
async def get_graph_data(
    days: int = 30,
    min_frequency: int = 1,
    source: str = "db",  # 'db' for persisted graph, 'live' for real-time
    user = Depends(get_current_user)
):
    """
    Get knowledge graph data. 
    - source='db': Returns persisted graph from knowledge_graph_nodes/edges tables
    - source='live': Generates from browsing history in real-time (simpler, no LLM)
    """
    try:
        if source == "db":
            # Fetch persisted graph from knowledge_graph tables
            nodes_result = supabase.table('knowledge_graph_nodes') \
                .select('*') \
                .eq('user_id', user.id) \
                .gte('frequency', min_frequency) \
                .execute()
            
            edges_result = supabase.table('knowledge_graph_edges') \
                .select('*, source:knowledge_graph_nodes!source_id(label), target:knowledge_graph_nodes!target_id(label)') \
                .eq('user_id', user.id) \
                .execute()
            
            db_nodes = nodes_result.data or []
            db_edges = edges_result.data or []
            
            # Transform to frontend format
            nodes = [{
                'id': n['id'],
                'label': n['label'],
                'type': n['kind'],
                'frequency': n['frequency'],
                'confidence': n.get('attrs', {}).get('confidence', 1.0),
                'recency_score': n.get('attrs', {}).get('recency_score', 0.5)
            } for n in db_nodes]
            
            links = [{
                'source': e['source_id'],
                'target': e['target_id'],
                'relation': e['relation'],
                'weight': e['weight'],
                'sourceLabel': e.get('source', {}).get('label') if e.get('source') else None,
                'targetLabel': e.get('target', {}).get('label') if e.get('target') else None
            } for e in db_edges]
            
            return {'nodes': nodes, 'links': links, 'source': 'database'}
        
        else:
            # Live processing from browsing history (original behavior)
            from datetime import timedelta
            date_threshold = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            
            result = supabase.table('browsing_history') \
                .select('*') \
                .eq('user_id', user.id) \
                .gte('created_at', date_threshold) \
                .order('created_at', desc=True) \
                .execute()
            
            history = result.data or []
            
            nodes = {}
            links = {}
            
            for entry in history:
                domain = entry.get('domain', '')
                entities = entry.get('entities', [])
                dwell_ms = entry.get('dwell_ms', 0)
                
                if domain:
                    domain_key = f"domain:{domain}"
                    if domain_key not in nodes:
                        nodes[domain_key] = {
                            'id': domain_key,
                            'label': domain.replace('www.', ''),
                            'type': 'domain',
                            'frequency': 0,
                            'totalDwell': 0
                        }
                    nodes[domain_key]['frequency'] += 1
                    nodes[domain_key]['totalDwell'] += dwell_ms
                
                for entity in entities:
                    text = entity.get('text', entity) if isinstance(entity, dict) else entity
                    if not text or len(str(text)) < 2:
                        continue
                    
                    entity_key = f"entity:{str(text).lower()}"
                    if entity_key not in nodes:
                        nodes[entity_key] = {
                            'id': entity_key,
                            'label': str(text),
                            'type': 'entity',
                            'frequency': 0
                        }
                    nodes[entity_key]['frequency'] += 1
                    
                    if domain:
                        link_key = f"{entity_key}|domain:{domain}"
                        if link_key not in links:
                            links[link_key] = {
                                'source': entity_key,
                                'target': f"domain:{domain}",
                                'strength': 0
                            }
                        links[link_key]['strength'] += 1
            
            filtered_nodes = [n for n in nodes.values() if n['frequency'] >= min_frequency]
            node_ids = set(n['id'] for n in filtered_nodes)
            filtered_links = [l for l in links.values() if l['source'] in node_ids and l['target'] in node_ids]
            
            return {'nodes': filtered_nodes, 'links': filtered_links, 'source': 'live'}
        
    except Exception as e:
        logger.error(f"Failed to get graph data: {e}")
        raise HTTPException(status_code=500, detail="Failed to get graph data")

@api_router.get("/graph/stats")
async def get_graph_stats(user = Depends(get_current_user)):
    """Get statistics about user's browsing history"""
    try:
        result = supabase.table('browsing_history') \
            .select('domain, dwell_ms, created_at') \
            .eq('user_id', user.id) \
            .execute()
        
        history = result.data or []
        
        # Calculate stats
        total_pages = len(history)
        total_dwell = sum(h.get('dwell_ms', 0) for h in history)
        unique_domains = len(set(h.get('domain', '') for h in history if h.get('domain')))
        
        return {
            'total_pages': total_pages,
            'total_dwell_ms': total_dwell,
            'unique_domains': unique_domains,
            'avg_dwell_ms': total_dwell // total_pages if total_pages > 0 else 0
        }
        
    except Exception as e:
        logger.error(f"Failed to get graph stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get stats")

# ============================================
# Admin: Seed Videos
# ============================================

@api_router.post("/admin/seed-videos")
async def seed_videos(force: bool = False):
    """Seed initial educational videos. Use force=true to re-seed."""
    try:
        # Check if videos already exist
        existing = supabase.table('videos').select('id').limit(1).execute()
        if existing.data and not force:
            return {"message": "Videos already seeded", "count": len(existing.data)}
        
        # Clear existing if forcing
        if force:
            supabase.table('videos').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        
        # Comprehensive educational videos covering all interest topics
        videos = [
            # AI & Technology
            {
                "id": str(uuid.uuid4()),
                "title": "Understanding Neural Networks",
                "description": "A visual guide to how neural networks learn and make decisions. Perfect for beginners.",
                "src": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400",
                "duration_ms": 45000,
                "provider": "seeded",
                "topics": ["AI", "Technology"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Attention is All You Need",
                "description": "The transformer architecture that revolutionized AI explained simply.",
                "src": "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400",
                "duration_ms": 65000,
                "provider": "seeded",
                "topics": ["AI", "Technology"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            # Psychology
            {
                "id": str(uuid.uuid4()),
                "title": "The Psychology of Decision Making",
                "description": "Explore cognitive biases and how they affect our daily choices.",
                "src": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
                "duration_ms": 60000,
                "provider": "seeded",
                "topics": ["Psychology", "Productivity"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            # Startups & Business
            {
                "id": str(uuid.uuid4()),
                "title": "Startup Funding Explained",
                "description": "From seed rounds to Series A: understanding how startups raise capital.",
                "src": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400",
                "duration_ms": 55000,
                "provider": "seeded",
                "topics": ["Startups", "Finance", "Business"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            # Philosophy
            {
                "id": str(uuid.uuid4()),
                "title": "Ancient Philosophy for Modern Life",
                "description": "How Stoic and Eastern philosophy can improve your daily life.",
                "src": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400",
                "duration_ms": 48000,
                "provider": "seeded",
                "topics": ["Philosophy", "Psychology"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            # History
            {
                "id": str(uuid.uuid4()),
                "title": "The History of the Internet",
                "description": "From ARPANET to Web3: a journey through the evolution of connectivity.",
                "src": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400",
                "duration_ms": 52000,
                "provider": "seeded",
                "topics": ["History", "Technology"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            # Health
            {
                "id": str(uuid.uuid4()),
                "title": "Building Healthy Habits",
                "description": "Science-backed strategies to create lasting positive changes.",
                "src": "https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400",
                "duration_ms": 58000,
                "provider": "seeded",
                "topics": ["Health", "Productivity"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            # Finance
            {
                "id": str(uuid.uuid4()),
                "title": "Compound Interest: The 8th Wonder",
                "description": "How small investments grow into massive wealth over time.",
                "src": "https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400",
                "duration_ms": 42000,
                "provider": "seeded",
                "topics": ["Finance", "Business"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            # Science
            {
                "id": str(uuid.uuid4()),
                "title": "Quantum Computing Demystified",
                "description": "Understanding qubits, superposition, and the future of computing.",
                "src": "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400",
                "duration_ms": 50000,
                "provider": "seeded",
                "topics": ["Science", "Technology"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "The Science of Sleep",
                "description": "Why we sleep and how to optimize your rest for peak performance.",
                "src": "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=400",
                "duration_ms": 47000,
                "provider": "seeded",
                "topics": ["Science", "Health"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            # Design
            {
                "id": str(uuid.uuid4()),
                "title": "Principles of Visual Design",
                "description": "Master typography, color theory, and layout fundamentals.",
                "src": "https://storage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=400",
                "duration_ms": 55000,
                "provider": "seeded",
                "topics": ["Design", "Productivity"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "UX Design Thinking",
                "description": "Human-centered design approaches for digital products.",
                "src": "https://storage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=400",
                "duration_ms": 62000,
                "provider": "seeded",
                "topics": ["Design", "Technology"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            # Productivity
            {
                "id": str(uuid.uuid4()),
                "title": "Deep Work Strategies",
                "description": "Cal Newport's framework for focused success in a distracted world.",
                "src": "https://storage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
                "thumbnail_url": "https://images.unsplash.com/photo-1483058712412-4245e9b90334?w=400",
                "duration_ms": 53000,
                "provider": "seeded",
                "topics": ["Productivity", "Psychology"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        
        # Insert videos
        result = supabase.table('videos').insert(videos).execute()
        
        return {"success": True, "count": len(videos), "message": "Videos seeded successfully"}
        
    except Exception as e:
        logger.error(f"Failed to seed videos: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to seed videos: {str(e)}")

# ============================================
# AI Video Generation & Personalized Feed
# ============================================

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', 'AIzaSyDFZjGFvlohaxDV3564Uev9Y2NPQnpFOnM')
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY', '')  # Optional

class VideoGenerateRequest(BaseModel):
    count: int = 3  # Number of videos to generate

@api_router.post("/videos/generate")
async def generate_ai_videos(
    request: VideoGenerateRequest = VideoGenerateRequest(),
    user = Depends(get_current_user)
):
    """
    Generate personalized AI videos using Veo 3.1 Fast.
    Uses user's interests and knowledge graph for personalization.
    Runs video generation in PARALLEL for speed.
    
    Videos are automatically CACHED for future feed sessions.
    """
    try:
        from services.personalization import PersonalizationEngine
        from services.video_generator import get_video_generator
        from services.video_cache import get_video_cache
        import asyncio
        
        # Build user's personalization profile
        engine = PersonalizationEngine(supabase)
        profile = await engine.get_user_profile(user.id)
        
        if profile.is_empty():
            return {
                'success': False,
                'message': 'Please complete onboarding to select your interests first.',
                'videos': [],
                'needs_onboarding': True
            }
        
        # Generate video prompts from profile
        prompts = engine.generate_video_prompts(profile, count=request.count)
        logger.info(f"Generated {len(prompts)} prompts for user {user.id}")
        
        # Initialize video generator with Veo 3.1 Fast
        generator = get_video_generator(GEMINI_API_KEY)
        
        # Initialize cache service
        cache = get_video_cache(supabase)
        
        # Generate videos IN PARALLEL for speed
        async def generate_and_cache(prompt_data):
            result = await generator.generate_video_from_prompt(prompt_data, user.id)
            
            # Cache the video if generation was successful
            if result.status == 'completed' and result.video_url:
                await cache.store_video(
                    user_id=user.id,
                    video_data={
                        'id': result.video_id,
                        'title': result.title,
                        'description': result.description,
                        'video_url': result.video_url,
                        'thumbnail_url': result.thumbnail_url,
                        'duration_seconds': result.duration_seconds,
                        'provider': result.provider,
                        'topics': result.topics or [],
                        'meta': {'prompt': result.prompt_used}
                    },
                    source_type='ai_generated'
                )
                logger.info(f"Cached video {result.video_id} for user {user.id}")
            
            return result
        
        # Fire all requests simultaneously
        tasks = [generate_and_cache(prompt) for prompt in prompts]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        stored_videos = []
        successful = 0
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Video generation error: {result}")
                continue
                
            video_record = {
                'id': result.video_id,
                'user_id': user.id,
                'title': result.title,
                'description': result.description,
                'src': result.video_url or '',
                'thumbnail_url': result.thumbnail_url,
                'duration_ms': result.duration_seconds * 1000,
                'provider': result.provider,
                'topics': result.topics or [],
                'meta': {
                    'prompt': result.prompt_used,
                    'status': result.status,
                    'error': result.error
                },
                'is_active': result.status == 'completed',
                'created_at': result.created_at
            }
            
            try:
                supabase.table('videos').insert(video_record).execute()
                stored_videos.append(result.to_dict())
                if result.status == 'completed':
                    successful += 1
            except Exception as e:
                logger.warning(f"Failed to store video {result.video_id}: {e}")
                stored_videos.append(result.to_dict())
        
        return {
            'success': True,
            'message': f'Generated {successful} AI videos based on your interests',
            'videos': stored_videos,
            'profile_topics': profile.get_top_topics(5),
            'cached': successful  # Number of videos cached for future
        }
        
    except Exception as e:
        logger.error(f"Failed to generate videos: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate videos: {str(e)}")

# Background task for video generation
background_generation_tasks = {}

@api_router.post("/videos/generate-background")
async def start_background_generation(
    request: VideoGenerateRequest = VideoGenerateRequest(),
    user = Depends(get_current_user)
):
    """
    Start background video generation (non-blocking).
    Returns immediately while videos are generated in parallel.
    Frontend can poll /videos/generation-status for updates.
    """
    try:
        from services.personalization import PersonalizationEngine
        
        # Build profile
        engine = PersonalizationEngine(supabase)
        profile = await engine.get_user_profile(user.id)
        
        if profile.is_empty():
            return {
                'started': False,
                'message': 'No interests found',
                'needs_onboarding': True
            }
        
        # Mark generation as started
        background_generation_tasks[user.id] = {
            'status': 'generating',
            'count': request.count,
            'started_at': datetime.now(timezone.utc).isoformat()
        }
        
        return {
            'started': True,
            'message': f'Started generating {request.count} videos in background',
            'topics': profile.get_top_topics(5)
        }
        
    except Exception as e:
        logger.error(f"Failed to start background generation: {e}")
        return {'started': False, 'error': str(e)}

@api_router.get("/feed/personalized")
async def get_personalized_feed(
    limit: int = 20,
    include_youtube: bool = True,
    user = Depends(get_optional_user)
):
    """
    Get highly personalized feed combining:
    - Cached AI-generated videos (shown first, 5-6 videos)
    - YouTube Shorts (interspersed in first 5-6)
    - Triggers background generation for more content
    
    Feed Strategy:
    1. First 5-6 videos = Mix of cached AI videos + YouTube Shorts
    2. While user watches, generate new AI videos in background
    3. New videos get added to cache for future sessions
    """
    try:
        from services.personalization import PersonalizationEngine
        from services.youtube_shorts import get_shorts_aggregator
        from services.video_cache import get_video_cache
        
        # Check if user is authenticated
        if not user:
            return {
                'videos': [],
                'message': 'Complete onboarding to get personalized content',
                'needs_onboarding': True,
                'total': 0
            }
        
        # Build user's personalization profile
        engine = PersonalizationEngine(supabase)
        profile = await engine.get_user_profile(user.id)
        
        if profile.is_empty():
            return {
                'videos': [],
                'message': 'Complete onboarding to get personalized content',
                'needs_onboarding': True,
                'total': 0
            }
        
        top_topics = profile.get_top_topics(5)
        feed_items = []
        
        # 1. Get CACHED AI-generated videos for this user
        cache = get_video_cache(supabase)
        cached_videos = await cache.get_cached_videos_for_user(
            user_id=user.id,
            topics=top_topics,
            source_types=['ai_generated'],
            limit=8
        )
        
        # Convert cached videos to feed items
        ai_items = []
        for video in cached_videos:
            ai_items.append({
                'id': video.id,
                'title': video.title,
                'description': video.description,
                'src': video.video_url,
                'video_url': video.video_url,
                'thumbnail_url': video.thumbnail_url,
                'duration_ms': video.duration_seconds * 1000,
                'provider': video.provider,
                'content_type': 'ai_generated',
                'source_type': 'ai_generated',
                'topics': video.topics,
                'is_cached': True
            })
        
        logger.info(f"Found {len(ai_items)} cached AI videos for user {user.id}")
        
        # 2. Get YouTube Shorts based on interests
        yt_items = []
        if include_youtube:
            try:
                aggregator = get_shorts_aggregator(YOUTUBE_API_KEY)
                shorts = await aggregator.get_shorts_for_interests(
                    interests=top_topics,
                    shorts_per_interest=5  # Get 5 shorts per interest = 15-25 total
                )
                
                for short in shorts:
                    short_dict = short.to_dict()
                    short_dict['content_type'] = 'youtube_shorts'
                    short_dict['source_type'] = 'youtube_shorts'
                    short_dict['is_cached'] = False
                    yt_items.append(short_dict)
                    
                logger.info(f"Found {len(yt_items)} YouTube shorts for topics: {top_topics}")
            except Exception as e:
                logger.warning(f"Failed to get YouTube shorts: {e}")
        
        # 3. Build feed - YouTube Shorts first if no cached AI videos
        # When AI videos exist, interleave them with YouTube
        interleaved = []
        ai_idx, yt_idx = 0, 0
        
        # If we have cached AI videos, interleave. Otherwise, just use YouTube Shorts.
        if len(ai_items) > 0:
            # INTERLEAVE: AI:YT ratio based on available content
            for i in range(min(15, len(ai_items) + len(yt_items))):
                position_in_cycle = i % 3  # 0,1,2 pattern
                
                if position_in_cycle < 2:  # Positions 0,1 = AI
                    if ai_idx < len(ai_items):
                        interleaved.append(ai_items[ai_idx])
                        ai_idx += 1
                    elif yt_idx < len(yt_items):
                        interleaved.append(yt_items[yt_idx])
                        yt_idx += 1
                else:  # Position 2 = YouTube
                    if yt_idx < len(yt_items):
                        interleaved.append(yt_items[yt_idx])
                        yt_idx += 1
                    elif ai_idx < len(ai_items):
                        interleaved.append(ai_items[ai_idx])
                        ai_idx += 1
        else:
            # No cached AI videos - use all YouTube Shorts
            interleaved = yt_items[:15]
            yt_idx = len(interleaved)
        
        # Add remaining items after initial mix
        remaining_ai = ai_items[ai_idx:]
        remaining_yt = yt_items[yt_idx:]
        
        # Combine all
        feed_items = interleaved + remaining_ai + remaining_yt
        
        # 4. If no content, return empty with topics for video generation
        if not feed_items:
            return {
                'videos': [],
                'total': 0,
                'personalization': {
                    'interests': [i.get('topic_name') for i in profile.interests],
                    'top_topics': top_topics,
                    'anchors_count': len(profile.anchors)
                },
                'needs_generation': True,
                'message': 'Generate AI videos to populate your feed'
            }
        
        # Determine if background generation is needed
        needs_generation = len(ai_items) < 4
        
        return {
            'videos': feed_items[:limit],
            'total': len(feed_items),
            'cached_count': len(ai_items),
            'youtube_count': len(yt_items),
            'needs_generation': needs_generation,
            'personalization': {
                'interests': [i.get('topic_name') for i in profile.interests],
                'top_topics': top_topics,
                'anchors_count': len(profile.anchors)
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get personalized feed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get personalized feed")

@api_router.get("/feed/cache-stats")
async def get_feed_cache_stats(user = Depends(get_current_user)):
    """Get statistics about user's cached videos."""
    try:
        from services.video_cache import get_video_cache
        
        cache = get_video_cache(supabase)
        stats = await cache.get_cache_stats(user.id)
        
        return {
            'success': True,
            'stats': stats
        }
    except Exception as e:
        logger.error(f"Failed to get cache stats: {e}")
        return {'success': False, 'stats': {}, 'error': str(e)}

@api_router.post("/feed/generate-background")
async def generate_background_videos(
    count: int = 6,
    user = Depends(get_current_user)
):
    """
    Trigger background video generation while user watches cached content.
    This is called automatically when the feed is loaded with few cached videos.
    """
    try:
        from services.personalization import PersonalizationEngine
        from services.video_generator import get_video_generator
        from services.video_cache import get_video_cache
        import asyncio
        
        # Get user profile
        engine = PersonalizationEngine(supabase)
        profile = await engine.get_user_profile(user.id)
        
        if profile.is_empty():
            return {
                'success': False,
                'message': 'No user profile found',
                'generated': 0
            }
        
        # Generate prompts
        prompts = engine.generate_video_prompts(profile, count=count)
        
        # Initialize services
        generator = get_video_generator(GEMINI_API_KEY)
        cache = get_video_cache(supabase)
        
        # Generate and cache in parallel
        async def generate_and_cache(prompt_data):
            result = await generator.generate_video_from_prompt(prompt_data, user.id)
            
            if result.status == 'completed' and result.video_url:
                await cache.store_video(
                    user_id=user.id,
                    video_data={
                        'id': result.video_id,
                        'title': result.title,
                        'description': result.description,
                        'video_url': result.video_url,
                        'thumbnail_url': result.thumbnail_url,
                        'duration_seconds': result.duration_seconds,
                        'provider': result.provider,
                        'topics': result.topics or [],
                        'meta': {'prompt': result.prompt_used}
                    },
                    source_type='ai_generated'
                )
            
            return result
        
        # Fire all tasks
        tasks = [generate_and_cache(p) for p in prompts]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Count successes
        successful = sum(1 for r in results 
                       if not isinstance(r, Exception) and r.status == 'completed')
        
        return {
            'success': True,
            'generated': successful,
            'total_attempted': len(prompts),
            'message': f'Generated and cached {successful} new videos'
        }
        
    except Exception as e:
        logger.error(f"Background generation failed: {e}")
        return {'success': False, 'generated': 0, 'error': str(e)}

@api_router.get("/user/interests")
async def get_user_interests(user = Depends(get_current_user)):
    """Get user's selected interests."""
    try:
        result = supabase.table('interests') \
            .select('*') \
            .eq('user_id', user.id) \
            .execute()
        
        return {
            'interests': result.data or [],
            'count': len(result.data or [])
        }
    except Exception as e:
        logger.error(f"Failed to get interests: {e}")
        raise HTTPException(status_code=500, detail="Failed to get interests")

class SaveInterestsRequest(BaseModel):
    interests: List[Dict[str, Any]]

@api_router.post("/user/interests")
async def save_user_interests(
    request: SaveInterestsRequest,
    user = Depends(get_current_user)
):
    """Save user's selected interests (bypasses RLS via service key)."""
    try:
        # Delete existing interests for user
        supabase.table('interests').delete().eq('user_id', user.id).execute()
        
        # Insert new interests
        interests_to_insert = []
        for interest in request.interests:
            interests_to_insert.append({
                'id': str(uuid.uuid4()),
                'user_id': user.id,
                'topic_slug': interest.get('topic_slug'),
                'topic_name': interest.get('topic_name'),
                'weight': interest.get('weight', 1.0),
                'created_at': datetime.now(timezone.utc).isoformat()
            })
        
        if interests_to_insert:
            result = supabase.table('interests').insert(interests_to_insert).execute()
            logger.info(f"Saved {len(interests_to_insert)} interests for user {user.id}")
        
        return {
            'success': True,
            'count': len(interests_to_insert),
            'message': f'Saved {len(interests_to_insert)} interests'
        }
    except Exception as e:
        logger.error(f"Failed to save interests: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save interests: {str(e)}")

# ============================================
# Include Router & Middleware
# ============================================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    mongo_client.close()
