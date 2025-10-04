"""
Sense Video Caching Service
============================
Manages cached/stored AI-generated videos for efficient feed delivery.
- Stores generated videos with user_id and topic associations
- Retrieves cached videos relevant to user's interests
- Supports video lifecycle management (cleanup, refresh)
"""

import os
import uuid
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class CachedVideo:
    """Represents a cached video entry."""
    id: str
    user_id: str
    title: str
    description: str
    video_url: str
    thumbnail_url: Optional[str]
    duration_seconds: int
    provider: str  # 'veo3.1', 'youtube', etc.
    source_type: str  # 'ai_generated', 'youtube_shorts', 'seeded'
    topics: List[str]
    relevance_score: float = 1.0
    view_count: int = 0
    created_at: str = None
    expires_at: Optional[str] = None
    meta: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "description": self.description,
            "video_url": self.video_url,
            "src": self.video_url,  # Alias for frontend compatibility
            "thumbnail_url": self.thumbnail_url,
            "duration_seconds": self.duration_seconds,
            "duration_ms": self.duration_seconds * 1000,
            "provider": self.provider,
            "source_type": self.source_type,
            "content_type": self.source_type,
            "topics": self.topics,
            "relevance_score": self.relevance_score,
            "view_count": self.view_count,
            "created_at": self.created_at or datetime.now(timezone.utc).isoformat(),
            "expires_at": self.expires_at,
            "meta": self.meta
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CachedVideo':
        return cls(
            id=data.get('id', str(uuid.uuid4())),
            user_id=data.get('user_id', ''),
            title=data.get('title', ''),
            description=data.get('description', ''),
            video_url=data.get('video_url') or data.get('src', ''),
            thumbnail_url=data.get('thumbnail_url'),
            duration_seconds=data.get('duration_seconds') or (data.get('duration_ms', 0) // 1000),
            provider=data.get('provider', 'unknown'),
            source_type=data.get('source_type') or data.get('content_type', 'ai_generated'),
            topics=data.get('topics', []),
            relevance_score=data.get('relevance_score', 1.0),
            view_count=data.get('view_count', 0),
            created_at=data.get('created_at'),
            expires_at=data.get('expires_at'),
            meta=data.get('meta', {})
        )


class VideoCacheService:
    """
    Service for caching and retrieving personalized videos.
    Uses Supabase as the backing store.
    """
    
    # Table name in Supabase
    TABLE_NAME = "cached_videos"
    
    # Default cache duration (7 days)
    DEFAULT_CACHE_DAYS = 7
    
    def __init__(self, supabase_client):
        """Initialize with Supabase client."""
        self.supabase = supabase_client
    
    async def store_video(
        self,
        user_id: str,
        video_data: Dict[str, Any],
        source_type: str = "ai_generated"
    ) -> Optional[CachedVideo]:
        """
        Store a generated video in the cache.
        
        Args:
            user_id: User who owns this cached video
            video_data: Video details (title, url, topics, etc.)
            source_type: Type of video ('ai_generated', 'youtube_shorts')
            
        Returns:
            CachedVideo if successful, None otherwise
        """
        try:
            video_id = video_data.get('id') or video_data.get('video_id') or str(uuid.uuid4())
            created_at = datetime.now(timezone.utc)
            expires_at = created_at + timedelta(days=self.DEFAULT_CACHE_DAYS)
            
            cached_video = CachedVideo(
                id=video_id,
                user_id=user_id,
                title=video_data.get('title', 'Untitled Video'),
                description=video_data.get('description', ''),
                video_url=video_data.get('video_url') or video_data.get('src', ''),
                thumbnail_url=video_data.get('thumbnail_url'),
                duration_seconds=video_data.get('duration_seconds', 10),
                provider=video_data.get('provider', 'veo3.1'),
                source_type=source_type,
                topics=video_data.get('topics', []),
                relevance_score=video_data.get('relevance_score', 1.0),
                view_count=0,
                created_at=created_at.isoformat(),
                expires_at=expires_at.isoformat(),
                meta=video_data.get('meta', {})
            )
            
            # Insert into database
            record = {
                'id': cached_video.id,
                'user_id': cached_video.user_id,
                'title': cached_video.title,
                'description': cached_video.description,
                'video_url': cached_video.video_url,
                'thumbnail_url': cached_video.thumbnail_url,
                'duration_seconds': cached_video.duration_seconds,
                'provider': cached_video.provider,
                'source_type': cached_video.source_type,
                'topics': cached_video.topics,
                'relevance_score': cached_video.relevance_score,
                'view_count': cached_video.view_count,
                'created_at': cached_video.created_at,
                'expires_at': cached_video.expires_at,
                'meta': cached_video.meta
            }
            
            self.supabase.table(self.TABLE_NAME).upsert(record).execute()
            logger.info(f"Cached video {video_id} for user {user_id}")
            
            return cached_video
            
        except Exception as e:
            logger.error(f"Failed to cache video: {e}")
            return None
    
    async def store_videos_batch(
        self,
        user_id: str,
        videos: List[Dict[str, Any]],
        source_type: str = "ai_generated"
    ) -> List[CachedVideo]:
        """
        Store multiple videos in the cache efficiently.
        
        Args:
            user_id: User who owns these cached videos
            videos: List of video data dicts
            source_type: Type of videos
            
        Returns:
            List of successfully cached videos
        """
        cached_videos = []
        
        for video_data in videos:
            cached = await self.store_video(user_id, video_data, source_type)
            if cached:
                cached_videos.append(cached)
        
        logger.info(f"Batch cached {len(cached_videos)}/{len(videos)} videos for user {user_id}")
        return cached_videos
    
    async def get_cached_videos_for_user(
        self,
        user_id: str,
        topics: Optional[List[str]] = None,
        source_types: Optional[List[str]] = None,
        limit: int = 20,
        exclude_viewed: bool = False
    ) -> List[CachedVideo]:
        """
        Get cached videos for a user, optionally filtered by topics.
        
        Args:
            user_id: User ID to fetch videos for
            topics: Filter by these topics (any match)
            source_types: Filter by source types ('ai_generated', 'youtube_shorts')
            limit: Maximum videos to return
            exclude_viewed: Exclude videos the user has already viewed
            
        Returns:
            List of CachedVideo objects sorted by relevance
        """
        try:
            # Build query
            query = self.supabase.table(self.TABLE_NAME) \
                .select('*') \
                .eq('user_id', user_id) \
                .gt('expires_at', datetime.now(timezone.utc).isoformat())
            
            # Filter by source types if provided
            if source_types:
                query = query.in_('source_type', source_types)
            
            # Order by relevance and recency
            query = query.order('relevance_score', desc=True) \
                        .order('created_at', desc=True) \
                        .limit(limit * 2)  # Fetch more to allow filtering
            
            result = query.execute()
            videos = result.data or []
            
            # Convert to CachedVideo objects
            cached_videos = [CachedVideo.from_dict(v) for v in videos]
            
            # Filter by topics if provided
            if topics:
                topic_lower = [t.lower() for t in topics]
                filtered = []
                for video in cached_videos:
                    video_topics = [t.lower() for t in video.topics]
                    # Check if any topic matches
                    if any(t in ' '.join(video_topics) for t in topic_lower):
                        filtered.append(video)
                    elif any(t in video.title.lower() or t in video.description.lower() for t in topic_lower):
                        filtered.append(video)
                cached_videos = filtered
            
            # Exclude viewed if requested
            if exclude_viewed:
                cached_videos = [v for v in cached_videos if v.view_count == 0]
            
            return cached_videos[:limit]
            
        except Exception as e:
            logger.error(f"Failed to get cached videos: {e}")
            return []
    
    async def get_global_cached_videos(
        self,
        topics: Optional[List[str]] = None,
        source_types: Optional[List[str]] = None,
        limit: int = 10
    ) -> List[CachedVideo]:
        """
        Get cached videos from all users (for sharing popular content).
        Useful for showing content while user-specific videos are being generated.
        
        Args:
            topics: Filter by topics
            source_types: Filter by source types
            limit: Maximum videos to return
            
        Returns:
            List of CachedVideo objects
        """
        try:
            query = self.supabase.table(self.TABLE_NAME) \
                .select('*') \
                .gt('expires_at', datetime.now(timezone.utc).isoformat()) \
                .order('view_count', desc=True) \
                .order('relevance_score', desc=True) \
                .limit(limit * 2)
            
            if source_types:
                query = query.in_('source_type', source_types)
            
            result = query.execute()
            videos = result.data or []
            
            cached_videos = [CachedVideo.from_dict(v) for v in videos]
            
            # Filter by topics if provided
            if topics:
                topic_lower = [t.lower() for t in topics]
                filtered = []
                for video in cached_videos:
                    video_topics = [t.lower() for t in video.topics]
                    if any(t in ' '.join(video_topics) for t in topic_lower):
                        filtered.append(video)
                cached_videos = filtered
            
            return cached_videos[:limit]
            
        except Exception as e:
            logger.error(f"Failed to get global cached videos: {e}")
            return []
    
    async def increment_view_count(self, video_id: str) -> bool:
        """Increment view count for a cached video."""
        try:
            # Get current count
            result = self.supabase.table(self.TABLE_NAME) \
                .select('view_count') \
                .eq('id', video_id) \
                .execute()
            
            if result.data:
                current_count = result.data[0].get('view_count', 0)
                self.supabase.table(self.TABLE_NAME) \
                    .update({'view_count': current_count + 1}) \
                    .eq('id', video_id) \
                    .execute()
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to increment view count: {e}")
            return False
    
    async def delete_expired_videos(self) -> int:
        """Clean up expired cached videos. Returns count of deleted videos."""
        try:
            result = self.supabase.table(self.TABLE_NAME) \
                .delete() \
                .lt('expires_at', datetime.now(timezone.utc).isoformat()) \
                .execute()
            
            deleted_count = len(result.data) if result.data else 0
            logger.info(f"Deleted {deleted_count} expired cached videos")
            return deleted_count
        except Exception as e:
            logger.error(f"Failed to delete expired videos: {e}")
            return 0
    
    async def get_cache_stats(self, user_id: str) -> Dict[str, Any]:
        """Get cache statistics for a user."""
        try:
            result = self.supabase.table(self.TABLE_NAME) \
                .select('source_type, view_count') \
                .eq('user_id', user_id) \
                .execute()
            
            videos = result.data or []
            
            stats = {
                'total_cached': len(videos),
                'ai_generated': len([v for v in videos if v.get('source_type') == 'ai_generated']),
                'youtube_shorts': len([v for v in videos if v.get('source_type') == 'youtube_shorts']),
                'total_views': sum(v.get('view_count', 0) for v in videos)
            }
            
            return stats
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {'total_cached': 0, 'ai_generated': 0, 'youtube_shorts': 0, 'total_views': 0}


# Singleton instance
_video_cache: Optional[VideoCacheService] = None


def get_video_cache(supabase_client) -> VideoCacheService:
    """Get or create the video cache service."""
    global _video_cache
    
    if _video_cache is None:
        _video_cache = VideoCacheService(supabase_client)
    
    return _video_cache
