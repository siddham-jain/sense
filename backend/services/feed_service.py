"""
Sense Feed Service
==================
Manages the personalized video feed combining:
- Cached AI-generated videos
- YouTube Shorts
- Background generation of new content

Feed Strategy:
1. First 5-6 videos = Mix of cached AI videos + YouTube Shorts
2. While user watches, generate new AI videos in background
3. New videos get added to cache and feed
"""

import os
import uuid
import logging
import asyncio
import random
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class FeedItem:
    """Represents a single item in the user's feed."""
    id: str
    title: str
    description: str
    video_url: str
    thumbnail_url: Optional[str]
    duration_seconds: int
    provider: str
    source_type: str  # 'ai_generated', 'youtube_shorts', 'cached'
    topics: List[str]
    position: int = 0
    is_cached: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "video_url": self.video_url,
            "src": self.video_url,
            "thumbnail_url": self.thumbnail_url,
            "duration_seconds": self.duration_seconds,
            "duration_ms": self.duration_seconds * 1000,
            "provider": self.provider,
            "source_type": self.source_type,
            "content_type": self.source_type,
            "topics": self.topics,
            "position": self.position,
            "is_cached": self.is_cached
        }


class FeedService:
    """
    Service for building and managing personalized video feeds.
    """
    
    # How many cached/YouTube videos to show before needing new generation
    INITIAL_FEED_SIZE = 6
    
    # Ratio of AI videos to YouTube Shorts in initial feed (e.g., 4:2)
    AI_TO_YOUTUBE_RATIO = (4, 2)
    
    def __init__(self, supabase_client, gemini_api_key: str = None, youtube_api_key: str = None):
        """Initialize the feed service."""
        self.supabase = supabase_client
        self.gemini_api_key = gemini_api_key or os.environ.get('GEMINI_API_KEY', '')
        self.youtube_api_key = youtube_api_key or os.environ.get('YOUTUBE_API_KEY', '')
    
    async def build_personalized_feed(
        self,
        user_id: str,
        user_interests: List[str],
        knowledge_graph_topics: List[str] = None,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        Build a personalized feed for the user.
        
        Strategy:
        1. Get cached AI videos for user's interests
        2. Get relevant YouTube Shorts
        3. Mix them together (AI videos first, YouTube interspersed)
        4. Trigger background generation if needed
        
        Args:
            user_id: User's ID
            user_interests: User's selected interests
            knowledge_graph_topics: Topics from user's knowledge graph
            limit: Max items in feed
            
        Returns:
            Dict with feed items and metadata
        """
        from services.video_cache import get_video_cache
        from services.youtube_shorts import get_shorts_aggregator
        
        # Combine user interests with knowledge graph topics
        all_topics = list(set(user_interests + (knowledge_graph_topics or [])))
        
        if not all_topics:
            return {
                'videos': [],
                'total': 0,
                'needs_onboarding': True,
                'message': 'Please complete onboarding to select your interests'
            }
        
        feed_items = []
        
        # 1. Get cached AI-generated videos
        cache_service = get_video_cache(self.supabase)
        cached_ai_videos = await cache_service.get_cached_videos_for_user(
            user_id=user_id,
            topics=all_topics,
            source_types=['ai_generated'],
            limit=self.AI_TO_YOUTUBE_RATIO[0] + 4  # Get extra for variety
        )
        
        logger.info(f"Found {len(cached_ai_videos)} cached AI videos for user {user_id}")
        
        # 2. Get YouTube Shorts
        youtube_shorts = []
        if self.youtube_api_key:
            try:
                aggregator = get_shorts_aggregator(self.youtube_api_key)
                shorts = await aggregator.get_shorts_for_interests(
                    interests=all_topics[:5],  # Top 5 interests
                    shorts_per_interest=2
                )
                youtube_shorts = shorts
                logger.info(f"Found {len(youtube_shorts)} YouTube shorts")
            except Exception as e:
                logger.warning(f"Failed to get YouTube shorts: {e}")
        
        # 3. Build the initial feed mix
        # Convert cached videos to FeedItems
        ai_items = []
        for i, video in enumerate(cached_ai_videos):
            ai_items.append(FeedItem(
                id=video.id,
                title=video.title,
                description=video.description,
                video_url=video.video_url,
                thumbnail_url=video.thumbnail_url,
                duration_seconds=video.duration_seconds,
                provider=video.provider,
                source_type='ai_generated',
                topics=video.topics,
                is_cached=True
            ))
        
        # Convert YouTube shorts to FeedItems
        yt_items = []
        for short in youtube_shorts:
            short_dict = short.to_dict() if hasattr(short, 'to_dict') else short
            yt_items.append(FeedItem(
                id=short_dict.get('id', str(uuid.uuid4())),
                title=short_dict.get('title', ''),
                description=short_dict.get('description', ''),
                video_url=short_dict.get('video_url') or short_dict.get('src', ''),
                thumbnail_url=short_dict.get('thumbnail_url'),
                duration_seconds=short_dict.get('duration_seconds', 60),
                provider='youtube',
                source_type='youtube_shorts',
                topics=short_dict.get('topics', []),
                is_cached=False
            ))
        
        # 4. Interleave the items for the first INITIAL_FEED_SIZE positions
        # Pattern: AI, AI, YT, AI, AI, YT (4:2 ratio)
        interleaved = self._interleave_feed(ai_items, yt_items, self.INITIAL_FEED_SIZE)
        
        # Add remaining items after the initial mix
        remaining_ai = ai_items[len([x for x in interleaved if x.source_type == 'ai_generated']):]
        remaining_yt = yt_items[len([x for x in interleaved if x.source_type == 'youtube_shorts']):]
        
        # Combine all
        feed_items = interleaved + remaining_ai + remaining_yt
        
        # Assign positions
        for i, item in enumerate(feed_items):
            item.position = i
        
        # 5. Determine if background generation is needed
        needs_generation = len(ai_items) < self.AI_TO_YOUTUBE_RATIO[0]
        
        return {
            'videos': [item.to_dict() for item in feed_items[:limit]],
            'total': len(feed_items),
            'cached_count': len(ai_items),
            'youtube_count': len(yt_items),
            'needs_generation': needs_generation,
            'personalization': {
                'interests': user_interests,
                'topics_used': all_topics[:10]
            }
        }
    
    def _interleave_feed(
        self,
        ai_items: List[FeedItem],
        yt_items: List[FeedItem],
        count: int
    ) -> List[FeedItem]:
        """
        Interleave AI videos and YouTube shorts for the initial feed.
        Pattern based on AI_TO_YOUTUBE_RATIO (default 4:2 = AI,AI,YT,AI,AI,YT)
        """
        result = []
        ai_idx = 0
        yt_idx = 0
        
        ai_per_cycle, yt_per_cycle = self.AI_TO_YOUTUBE_RATIO
        total_per_cycle = ai_per_cycle + yt_per_cycle
        
        for i in range(count):
            position_in_cycle = i % total_per_cycle
            
            if position_in_cycle < ai_per_cycle:
                # Add AI video
                if ai_idx < len(ai_items):
                    result.append(ai_items[ai_idx])
                    ai_idx += 1
                elif yt_idx < len(yt_items):
                    # Fallback to YouTube if no AI videos
                    result.append(yt_items[yt_idx])
                    yt_idx += 1
            else:
                # Add YouTube short
                if yt_idx < len(yt_items):
                    result.append(yt_items[yt_idx])
                    yt_idx += 1
                elif ai_idx < len(ai_items):
                    # Fallback to AI if no YouTube shorts
                    result.append(ai_items[ai_idx])
                    ai_idx += 1
        
        return result
    
    async def trigger_background_generation(
        self,
        user_id: str,
        topics: List[str],
        count: int = 6
    ) -> Dict[str, Any]:
        """
        Trigger background video generation.
        This runs in parallel while user watches cached content.
        
        Args:
            user_id: User's ID
            topics: Topics to generate videos for
            count: Number of videos to generate
            
        Returns:
            Status dict
        """
        from services.personalization import PersonalizationEngine
        from services.video_generator import get_video_generator
        from services.video_cache import get_video_cache
        
        try:
            # Generate prompts
            engine = PersonalizationEngine(self.supabase)
            profile = await engine.get_user_profile(user_id)
            
            if profile.is_empty():
                return {'success': False, 'message': 'No user profile found'}
            
            prompts = engine.generate_video_prompts(profile, count=count)
            
            # Initialize generator
            generator = get_video_generator(self.gemini_api_key)
            
            # Generate videos in parallel
            async def generate_and_cache(prompt_data):
                result = await generator.generate_video_from_prompt(prompt_data, user_id)
                
                # Cache the result if successful
                if result.status == 'completed' and result.video_url:
                    cache = get_video_cache(self.supabase)
                    await cache.store_video(
                        user_id=user_id,
                        video_data=result.to_dict(),
                        source_type='ai_generated'
                    )
                
                return result
            
            # Fire all generation tasks
            tasks = [generate_and_cache(prompt) for prompt in prompts]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Count successes
            successful = sum(1 for r in results 
                          if not isinstance(r, Exception) and r.status == 'completed')
            
            return {
                'success': True,
                'generated': successful,
                'total_attempted': len(prompts),
                'message': f'Generated {successful} new videos'
            }
            
        except Exception as e:
            logger.error(f"Background generation failed: {e}")
            return {'success': False, 'error': str(e)}


# Singleton
_feed_service: Optional[FeedService] = None


def get_feed_service(supabase_client, gemini_key: str = None, youtube_key: str = None) -> FeedService:
    """Get or create the feed service."""
    global _feed_service
    
    if _feed_service is None:
        _feed_service = FeedService(supabase_client, gemini_key, youtube_key)
    
    return _feed_service
