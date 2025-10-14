import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { 
  Heart, Bookmark, Share2, Volume2, VolumeX, Play, Pause, 
  ChevronUp, ChevronDown, Sparkles, MessageCircle, Eye,
  MoreHorizontal, RefreshCw, Zap, ExternalLink, Youtube,
  Network, Home, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function FeedPage() {
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [personalization, setPersonalization] = useState(null);
  const [interactions, setInteractions] = useState({});
  const containerRef = useRef(null);
  const { user, session } = useAuth();
  const { isDark } = useTheme();
  const [backgroundGenerating, setBackgroundGenerating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user && session) {
      fetchPersonalizedFeed();
      fetchInteractions();
    } else {
      setLoading(false);
      setNeedsOnboarding(true);
    }
  }, [user, session]);

  const getAuthHeaders = () => {
    if (session?.access_token) {
      return {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      };
    }
    return { 'Content-Type': 'application/json' };
  };

  // Trigger background video generation while user watches cached content
  const triggerBackgroundGeneration = async () => {
    if (backgroundGenerating) return;
    
    setBackgroundGenerating(true);
    try {
      // Use the new background generation endpoint (generates and caches automatically)
      const response = await fetch(`${BACKEND_URL}/api/feed/generate-background?count=6`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      const result = await response.json();
      
      if (result.success && result.generated > 0) {
        // New videos are cached - fetch updated feed
        const feedResponse = await fetch(
          `${BACKEND_URL}/api/feed/personalized?limit=20&include_youtube=true`,
          { headers: getAuthHeaders() }
        );
        
        const feedData = await feedResponse.json();
        if (feedData.videos?.length > 0) {
          setVideos(feedData.videos);
          toast.success(`${result.generated} new AI videos added to your feed!`);
        }
      }
    } catch (err) {
      console.error('Background generation failed:', err);
    } finally {
      setBackgroundGenerating(false);
    }
  };

  const fetchPersonalizedFeed = async () => {
    try {
      // Use the new personalized feed endpoint (returns cached + YouTube mix)
      const response = await fetch(
        `${BACKEND_URL}/api/feed/personalized?limit=20&include_youtube=true`,
        { headers: getAuthHeaders() }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch personalized feed');
      }
      
      const data = await response.json();
      
      if (data.needs_onboarding) {
        setNeedsOnboarding(true);
        setVideos([]);
      } else {
        setVideos(data.videos || []);
        setPersonalization(data.personalization);
        setNeedsOnboarding(false);
        
        // Only trigger background generation if backend says we need more content
        if (data.needs_generation && data.videos?.length > 0) {
          // Small delay to let user start watching, then generate in background
          setTimeout(() => {
            triggerBackgroundGeneration();
          }, 3000);
        }
      }
    } catch (err) {
      console.error('Failed to fetch personalized feed:', err);
      toast.error('Failed to load your personalized feed');
    } finally {
      setLoading(false);
    }
  };

  const fetchInteractions = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('feed_interactions')
        .select('video_id, action')
        .eq('user_id', user.id);
      
      const interactionMap = {};
      data?.forEach(i => {
        if (!interactionMap[i.video_id]) interactionMap[i.video_id] = {};
        interactionMap[i.video_id][i.action] = true;
      });
      setInteractions(interactionMap);
    } catch (err) {
      console.error('Failed to fetch interactions:', err);
    }
  };

  const generateAIVideos = async () => {
    if (!user || !session) {
      toast.error('Please sign in to generate videos');
      return;
    }
    
    setGenerating(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/videos/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ count: 3 })
      });
      
      const result = await response.json();
      
      if (result.needs_onboarding) {
        toast.error('Please complete onboarding first');
        navigate('/onboarding');
        return;
      }
      
      if (!result.success) {
        toast.error(result.message || 'Failed to generate videos');
        return;
      }
      
      const successful = result.videos?.filter(v => v.status === 'completed').length || 0;
      const generating_count = result.videos?.filter(v => v.status === 'generating').length || 0;
      
      if (successful > 0) {
        toast.success(`Generated ${successful} AI videos for you!`);
      } else if (generating_count > 0) {
        toast.info(`${generating_count} videos are being generated...`);
      } else {
        toast.warning('Video generation in progress. Check back soon!');
      }
      
      // Refresh the feed
      await fetchPersonalizedFeed();
    } catch (err) {
      console.error('Failed to generate videos:', err);
      toast.error('Video generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const scrollToVideo = useCallback((direction) => {
    const newIndex = direction === 'up' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(videos.length - 1, currentIndex + 1);
    
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, videos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'k') scrollToVideo('up');
      if (e.key === 'ArrowDown' || e.key === 'j') scrollToVideo('down');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollToVideo]);

  // Loading state - Full screen dark mode
  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-6"
        >
          <div className="relative w-16 h-16 mx-auto">
            <motion.div
              className="absolute inset-0 border border-[#D4AF37]/30 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-2 border border-[#D4AF37]/20 rounded-full"
              animate={{ rotate: -360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            Loading feed
          </p>
        </motion.div>
      </div>
    );
  }

  // Needs Onboarding state
  if (needsOnboarding) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-px h-12 bg-[#D4AF37] mx-auto mb-8" />
          <h2 className="font-display text-3xl mb-4 text-white">
            Tell us what you <em className="text-[#D4AF37]">love</em>
          </h2>
          <p className="text-sm mb-8 text-white/50">
            Complete onboarding to get a personalized feed tailored to your interests and browsing patterns.
          </p>
          <Button
            onClick={() => navigate('/onboarding')}
            className="bg-[#D4AF37] hover:bg-[#B8942E] text-black px-8 py-3 flex items-center gap-2 mx-auto"
          >
            <Sparkles size={16} />
            Select Your Interests
          </Button>
        </motion.div>
      </div>
    );
  }

  // Empty state (has interests but no content yet)
  if (videos.length === 0) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-px h-12 bg-[#D4AF37] mx-auto mb-8" />
          <h2 className="font-display text-3xl mb-4 text-white">
            Your feed is <em className="text-[#D4AF37]">ready</em>
          </h2>
          <p className="text-sm mb-4 text-white/50">
            Generate AI videos based on your interests:
          </p>
          {personalization?.interests?.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {personalization.interests.slice(0, 5).map((interest, i) => (
                <span key={i} className="text-xs px-3 py-1 bg-[#D4AF37]/10 text-[#D4AF37] rounded-full">
                  {interest}
                </span>
              ))}
            </div>
          )}
          <Button
            onClick={generateAIVideos}
            disabled={generating}
            className="bg-[#D4AF37] hover:bg-[#B8942E] text-black px-8 py-3 flex items-center gap-2 mx-auto"
          >
            <Sparkles size={16} />
            {generating ? 'Generating...' : 'Generate Videos'}
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <AppLayout hideNav>
      <div className={`relative h-full w-full overflow-hidden ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#1A1A1A]'}`}>
        {/* Video Container - Full Screen Locked */}
        <AnimatePresence mode="wait">
          {videos[currentIndex] && (
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute inset-0"
            >
              <VideoCard
                video={videos[currentIndex]}
                isActive={true}
                interactions={interactions[videos[currentIndex]?.id] || {}}
                userId={user?.id}
                onInteraction={fetchInteractions}
                index={currentIndex}
                total={videos.length}
                isDark={isDark}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Elegant Navigation Arrows */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-3">
          <NavArrow
            direction="up"
            onClick={() => scrollToVideo('up')}
            disabled={currentIndex === 0}
            isDark={isDark}
          />
          <NavArrow
            direction="down"
            onClick={() => scrollToVideo('down')}
            disabled={currentIndex === videos.length - 1}
            isDark={isDark}
          />
        </div>

        {/* Top Bar - Navigation, Video Counter & Generate Button */}
        <div className="absolute top-0 left-0 right-0 z-30 p-4 flex items-center justify-between">
          {/* Left side - Logo & Navigation */}
          <div className="flex items-center gap-4">
            {/* Logo/Home */}
            <Link 
              to="/feed"
              className="backdrop-blur-md bg-black/20 px-4 py-2 rounded-full"
            >
              <span className="font-display text-lg text-white">
                <em className="text-[#D4AF37]">Sense</em>
              </span>
            </Link>
            
            {/* Knowledge Graph Link */}
            <Link
              to="/graph"
              className="backdrop-blur-md bg-black/20 hover:bg-white/10 px-4 py-2 rounded-full flex items-center gap-2 transition-all"
            >
              <Network size={14} className="text-[#D4AF37]" />
              <span className="text-[10px] uppercase tracking-wider text-white/70">Graph</span>
            </Link>
            
            {/* Video Counter */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="backdrop-blur-md bg-black/20 px-4 py-2 rounded-full flex items-center gap-3"
            >
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">
                Video
              </span>
              <span className="font-mono text-sm text-white">
                {String(currentIndex + 1).padStart(2, '0')}
                <span className="text-white/40"> / {String(videos.length).padStart(2, '0')}</span>
              </span>
            </motion.div>
            
            {videos[currentIndex]?.provider === 'veo3' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="backdrop-blur-md bg-[#D4AF37]/20 px-3 py-1.5 rounded-full flex items-center gap-2"
              >
                <Zap size={12} className="text-[#D4AF37]" />
                <span className="text-[10px] uppercase tracking-wider text-[#D4AF37]">AI Generated</span>
              </motion.div>
            )}
          </div>
          
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={generateAIVideos}
            disabled={generating}
            className="backdrop-blur-md bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full flex items-center gap-2 text-white/80 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
            <span className="text-xs">Generate</span>
          </motion.button>
        </div>

        {/* Progress Dots */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2">
          {videos.slice(
            Math.max(0, currentIndex - 3),
            Math.min(videos.length, currentIndex + 4)
          ).map((_, idx) => {
            const actualIdx = Math.max(0, currentIndex - 3) + idx;
            return (
              <motion.button
                key={actualIdx}
                onClick={() => setCurrentIndex(actualIdx)}
                className={`transition-all duration-300 rounded-full ${
                  actualIdx === currentIndex 
                    ? 'w-2 h-6 bg-[#D4AF37]' 
                    : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                }`}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              />
            );
          })}
        </div>

        {/* Keyboard Shortcuts Hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30"
        >
          <div className="backdrop-blur-md bg-black/20 px-4 py-2 rounded-full">
            <span className="text-[10px] text-white/40">
              Press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/60 mx-1">↑</kbd>
              <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/60 mx-1">↓</kbd> to navigate
            </span>
          </div>
        </motion.div>
        
        {/* Generating Overlay */}
        <AnimatePresence>
          {generating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="text-center space-y-6"
              >
                <div className="relative w-20 h-20 mx-auto">
                  <motion.div
                    className="absolute inset-0 border-2 border-[#D4AF37]/30 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                  <motion.div
                    className="absolute inset-3 border-2 border-[#D4AF37]/50 rounded-full"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                </div>
                <div>
                  <h3 className="font-display text-xl text-white mb-2">
                    Creating your <em className="text-[#D4AF37]">experience</em>
                  </h3>
                  <p className="text-sm text-white/50">
                    AI is generating personalized videos...
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

// Elegant Navigation Arrow Component
function NavArrow({ direction, onClick, disabled, isDark }) {
  const Icon = direction === 'up' ? ChevronUp : ChevronDown;
  
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`
        group relative w-12 h-12 flex items-center justify-center
        transition-all duration-500 disabled:opacity-20 disabled:cursor-not-allowed
      `}
      whileHover={{ scale: disabled ? 1 : 1.1 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
    >
      {/* Outer ring */}
      <div className="absolute inset-0 border border-white/20 rounded-full group-hover:border-white/40 transition-all duration-500" />
      
      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-full bg-[#D4AF37]/0 group-hover:bg-[#D4AF37]/10 transition-all duration-500" />
      
      {/* Icon */}
      <Icon 
        size={20} 
        strokeWidth={1.5}
        className="text-white/60 group-hover:text-white transition-all duration-300"
      />
    </motion.button>
  );
}

// Full-screen Video Card Component
function VideoCard({ video, isActive, interactions, userId, onInteraction, index, total, isDark }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(interactions?.like || false);
  const [saved, setSaved] = useState(interactions?.save || false);
  const [showDetails, setShowDetails] = useState(false);
  const videoRef = useRef(null);
  const heartControls = useAnimation();

  // Guard against undefined video
  if (!video) return null;

  useEffect(() => {
    setLiked(interactions?.like || false);
    setSaved(interactions?.save || false);
  }, [interactions]);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
        setProgress(0);
      }
    }
  }, [isActive]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const percent = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(percent);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDoubleTap = async () => {
    if (!liked) {
      await handleInteraction('like');
      heartControls.start({
        scale: [0, 1.2, 1],
        opacity: [0, 1, 0],
        transition: { duration: 0.8 }
      });
    }
  };

  const handleInteraction = async (action) => {
    if (!userId) {
      toast.error('Please sign in to interact');
      return;
    }

    try {
      if (action === 'like') setLiked(!liked);
      if (action === 'save') setSaved(!saved);

      await supabase.from('feed_interactions').insert({
        user_id: userId,
        video_id: video.id,
        action,
        value: { timestamp: new Date().toISOString() }
      });

      if (action === 'like' && !liked) toast.success('Added to favorites');
      if (action === 'save' && !saved) toast.success('Saved to collection');
      if (action === 'share') {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied');
      }

      onInteraction?.();
    } catch (err) {
      console.error('Interaction error:', err);
    }
  };

  // Determine if this is a YouTube video
  const isYouTube = video.source_type === 'youtube_shorts' || video.provider === 'youtube';
  const videoSrc = video.src || video.video_url;
  
  return (
    <div className="relative h-full w-full flex items-center justify-center">
      {/* Video Background - Full Screen */}
      <div className="absolute inset-0 bg-black">
        {isYouTube ? (
          // YouTube embed for Shorts
          <iframe
            src={videoSrc}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            frameBorder="0"
            data-testid="youtube-player"
          />
        ) : videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-contain"
            loop
            muted={isMuted}
            playsInline
            onClick={togglePlay}
            onDoubleClick={handleDoubleTap}
            onTimeUpdate={handleTimeUpdate}
            data-testid="video-player"
          />
        ) : (
          <div
            className="w-full h-full bg-gradient-to-br from-[#1A1A1A] to-[#0a0a0a] flex items-center justify-center cursor-pointer"
            onClick={togglePlay}
            onDoubleClick={handleDoubleTap}
          >
            {video.thumbnail_url ? (
              <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center">
                <Play size={64} className="text-white/20 mx-auto mb-4" strokeWidth={1} />
                <p className="text-white/40 text-sm">Video loading...</p>
              </div>
            )}
          </div>
        )}
        
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />
      </div>

      {/* Heart Animation */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
        initial={{ opacity: 0, scale: 0 }}
        animate={heartControls}
      >
        <Heart size={120} className="text-[#D4AF37] fill-[#D4AF37] drop-shadow-2xl" />
      </motion.div>

      {/* Play/Pause Indicator */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <Play size={32} className="text-white ml-1" strokeWidth={1.5} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Side Actions */}
      <div className="absolute right-6 bottom-32 flex flex-col items-center gap-5 z-20">
        <ActionButton 
          icon={Heart} 
          active={liked} 
          onClick={() => handleInteraction('like')} 
          label={liked ? 'Liked' : 'Like'}
          count={video.likes_count}
        />
        <ActionButton 
          icon={MessageCircle} 
          onClick={() => setShowDetails(!showDetails)} 
          label="Details"
        />
        <ActionButton 
          icon={Bookmark} 
          active={saved} 
          onClick={() => handleInteraction('save')} 
          label={saved ? 'Saved' : 'Save'}
        />
        <ActionButton 
          icon={Share2} 
          onClick={() => handleInteraction('share')} 
          label="Share"
        />
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-white/20 hover:text-white transition-all"
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Video Info - Bottom */}
      <div className="absolute bottom-0 left-0 right-24 p-6 z-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-lg"
        >
          {/* Topics */}
          <div className="flex flex-wrap gap-2 mb-3">
            {(video.topics || []).slice(0, 3).map((topic, i) => (
              <span 
                key={i}
                className="text-[10px] uppercase tracking-wider text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-1 rounded-full"
              >
                {topic}
              </span>
            ))}
          </div>
          
          {/* Title */}
          <h2 className="font-display text-2xl md:text-3xl text-white leading-tight mb-2">
            {video.title}
          </h2>
          
          {/* Description - Expandable */}
          <AnimatePresence>
            {showDetails && video.description && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-white/60 leading-relaxed mb-3"
              >
                {video.description}
              </motion.p>
            )}
          </AnimatePresence>
          
          {/* Source */}
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              video.source_type === 'youtube_shorts' 
                ? 'bg-gradient-to-br from-red-500 to-red-600' 
                : 'bg-gradient-to-br from-[#D4AF37] to-[#B8942E]'
            }`}>
              <span className="text-xs font-bold text-white">
                {video.source_type === 'youtube_shorts' ? 'YT' : 'S'}
              </span>
            </div>
            <div>
              <p className="text-sm text-white/80">
                {video.source_type === 'youtube_shorts' ? 'YouTube Shorts' : 'Sense'}
              </p>
              <p className="text-[10px] text-white/40">
                {video.source_type === 'youtube_shorts' 
                  ? 'Curated for your interests' 
                  : video.is_cached 
                    ? 'AI Generated • Cached for you'
                    : 'AI Generated for you'
                }
              </p>
            </div>
            {/* Cached Badge */}
            {video.is_cached && video.source_type !== 'youtube_shorts' && (
              <span className="ml-2 text-[8px] uppercase tracking-wider bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-0.5 rounded-full">
                Cached
              </span>
            )}
          </div>
        </motion.div>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-30">
        <motion.div
          className="h-full bg-[#D4AF37]"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>
    </div>
  );
}

// Action Button Component
function ActionButton({ icon: Icon, active, onClick, label, count }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.button
        onClick={onClick}
        className={`
          w-11 h-11 rounded-full backdrop-blur-sm flex items-center justify-center transition-all duration-300
          ${active 
            ? 'bg-[#D4AF37] text-black' 
            : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
          }
        `}
        whileTap={{ scale: 0.9 }}
      >
        <Icon size={20} strokeWidth={1.5} className={active ? 'fill-current' : ''} />
      </motion.button>
      {count !== undefined && (
        <span className="text-[10px] text-white/60">{count}</span>
      )}
    </div>
  );
}
