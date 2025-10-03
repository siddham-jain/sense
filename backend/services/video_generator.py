"""
Sense AI Video Generator (Updated)
===================================
Generates personalized infotainment videos using Google Veo 3.1 Fast
based on user's personalization profile.
"""

import os
import uuid
import time
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

import google.generativeai as genai

logger = logging.getLogger(__name__)

# Veo 3.1 Fast Model - optimized for speed
VEO_MODEL = "veo-3.1-fast-generate-preview"
VIDEO_DURATION = 8  # seconds


@dataclass
class VideoGenerationResult:
    """Result of a video generation request."""
    video_id: str
    status: str  # pending, generating, completed, failed
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    title: str = ""
    description: str = ""
    prompt_used: str = ""
    topics: List[str] = None
    duration_seconds: int = VIDEO_DURATION
    error: Optional[str] = None
    created_at: str = None
    provider: str = "veo3.1"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "video_id": self.video_id,
            "status": self.status,
            "video_url": self.video_url,
            "thumbnail_url": self.thumbnail_url,
            "title": self.title,
            "description": self.description,
            "prompt_used": self.prompt_used,
            "topics": self.topics or [],
            "duration_seconds": self.duration_seconds,
            "error": self.error,
            "created_at": self.created_at or datetime.now(timezone.utc).isoformat(),
            "provider": self.provider
        }


class VideoGeneratorService:
    """
    Service for generating personalized infotainment videos using Veo 3.1 Fast.
    """
    
    def __init__(self, api_key: str):
        """Initialize the video generator with Gemini API key."""
        self.api_key = api_key
        genai.configure(api_key=api_key)
        
        # Check available models
        try:
            available_models = [m.name for m in genai.list_models() if 'veo' in m.name.lower()]
            logger.info(f"Available Veo models: {available_models}")
            
            # Use veo-3.1-fast if available, fallback to veo-3.0
            if 'models/veo-3.1-fast-generate-preview' in available_models:
                self.model_name = 'veo-3.1-fast-generate-preview'
            elif 'models/veo-3.0-generate-001' in available_models:
                self.model_name = 'veo-3.0-generate-001'
            else:
                self.model_name = available_models[0] if available_models else VEO_MODEL
                
            logger.info(f"Using video model: {self.model_name}")
        except Exception as e:
            logger.warning(f"Could not list models: {e}")
            self.model_name = VEO_MODEL
    
    async def generate_video_from_prompt(
        self,
        prompt_data: Dict[str, Any],
        user_id: str
    ) -> VideoGenerationResult:
        """
        Generate a single video from a prompt.
        
        Args:
            prompt_data: Dict containing prompt, title, description, topic
            user_id: User ID for tracking
            
        Returns:
            VideoGenerationResult with video details or error
        """
        video_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        
        prompt = prompt_data.get('prompt', '')
        title = prompt_data.get('title', 'AI Generated Video')
        description = prompt_data.get('description', '')
        topic = prompt_data.get('topic', '')
        
        try:
            logger.info(f"Generating video for user {user_id}: {title}")
            logger.info(f"Using prompt: {prompt[:100]}...")
            
            # Initialize the model
            model = genai.GenerativeModel(self.model_name)
            
            # Generate video
            response = await asyncio.to_thread(
                self._generate_video_sync,
                model,
                prompt
            )
            
            if response and response.get('video_url'):
                logger.info(f"Video generated successfully: {video_id}")
                return VideoGenerationResult(
                    video_id=video_id,
                    status="completed",
                    video_url=response['video_url'],
                    thumbnail_url=response.get('thumbnail_url'),
                    title=title,
                    description=description,
                    prompt_used=prompt,
                    topics=[topic] if topic else [],
                    duration_seconds=VIDEO_DURATION,
                    created_at=created_at,
                    provider="veo3.1"
                )
            else:
                # Video generation initiated but URL not immediately available
                logger.info(f"Video generation initiated: {video_id}")
                return VideoGenerationResult(
                    video_id=video_id,
                    status="generating",
                    title=title,
                    description=description,
                    prompt_used=prompt,
                    topics=[topic] if topic else [],
                    created_at=created_at,
                    provider="veo3.1"
                )
                
        except Exception as e:
            logger.error(f"Video generation failed for {video_id}: {str(e)}")
            return VideoGenerationResult(
                video_id=video_id,
                status="failed",
                title=title,
                description=description,
                prompt_used=prompt,
                topics=[topic] if topic else [],
                error=str(e),
                created_at=created_at,
                provider="veo3.1"
            )
    
    def _generate_video_sync(self, model, prompt: str) -> Dict[str, Any]:
        """
        Synchronous video generation call to Veo.
        """
        try:
            response = model.generate_content(
                prompt,
                generation_config={
                    "response_mime_type": "video/mp4",
                }
            )
            
            if response and hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                
                if hasattr(candidate, 'content') and candidate.content:
                    for part in candidate.content.parts:
                        if hasattr(part, 'file_data') and part.file_data:
                            return {
                                'video_url': part.file_data.file_uri,
                                'mime_type': part.file_data.mime_type
                            }
                        elif hasattr(part, 'inline_data') and part.inline_data:
                            # For inline video data, we'd need to upload to storage
                            # For now, return as base64
                            return {
                                'video_data': part.inline_data.data,
                                'mime_type': part.inline_data.mime_type
                            }
            
            return None
            
        except Exception as e:
            logger.error(f"Veo API error: {str(e)}")
            raise
    
    async def generate_personalized_videos(
        self,
        prompts: List[Dict[str, Any]],
        user_id: str
    ) -> List[VideoGenerationResult]:
        """
        Generate multiple personalized videos.
        
        Args:
            prompts: List of prompt data dicts
            user_id: User ID
            
        Returns:
            List of VideoGenerationResult
        """
        results = []
        
        for prompt_data in prompts:
            result = await self.generate_video_from_prompt(prompt_data, user_id)
            results.append(result)
            
            # Small delay between requests
            await asyncio.sleep(0.5)
        
        return results


# Singleton instance
_video_generator: Optional[VideoGeneratorService] = None


def get_video_generator(api_key: str = None) -> VideoGeneratorService:
    """Get or create the video generator service."""
    global _video_generator
    
    if _video_generator is None:
        key = api_key or os.environ.get('GEMINI_API_KEY')
        if not key:
            raise ValueError("GEMINI_API_KEY not provided")
        _video_generator = VideoGeneratorService(key)
    
    return _video_generator
