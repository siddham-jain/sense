import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const TOPICS = [
  { 
    slug: 'ai', 
    name: 'AI', 
    subtitle: 'Artificial Intelligence & Machine Learning',
    image: 'https://images.unsplash.com/photo-1732020858816-93c130ab8f49?crop=entropy&cs=srgb&fm=jpg&q=85'
  },
  { 
    slug: 'technology', 
    name: 'Technology', 
    subtitle: 'Latest tech innovations & trends',
    image: 'https://images.unsplash.com/photo-1685211198800-871bab6e70d8?crop=entropy&cs=srgb&fm=jpg&q=85'
  },
  { 
    slug: 'startups', 
    name: 'Startups', 
    subtitle: 'Entrepreneurship & startup culture',
    image: 'https://images.unsplash.com/photo-1690383921891-3f0a7567d815?crop=entropy&cs=srgb&fm=jpg&q=85'
  },
  { 
    slug: 'business', 
    name: 'Business', 
    subtitle: 'Business strategy & leadership',
    image: 'https://images.unsplash.com/photo-1752159684779-0639174cdfac?crop=entropy&cs=srgb&fm=jpg&q=85'
  },
  { 
    slug: 'history', 
    name: 'History', 
    subtitle: 'Historical events & civilizations',
    image: 'https://images.unsplash.com/photo-1758040556071-b887446cffa9?crop=entropy&cs=srgb&fm=jpg&q=85'
  },
  { 
    slug: 'psychology', 
    name: 'Psychology', 
    subtitle: 'Human behavior & cognitive science',
    image: 'https://images.unsplash.com/photo-1549925245-f20a1bac6454?crop=entropy&cs=srgb&fm=jpg&q=85'
  },
  { 
    slug: 'finance', 
    name: 'Finance', 
    subtitle: 'Markets, investing & economics',
    image: 'https://images.unsplash.com/photo-1618044733300-9472054094ee?crop=entropy&cs=srgb&fm=jpg&q=85'
  },
  { 
    slug: 'philosophy', 
    name: 'Philosophy', 
    subtitle: 'Ideas, ethics & existential questions',
    image: 'https://images.unsplash.com/photo-1721943351594-179ded3c4ebb?crop=entropy&cs=srgb&fm=jpg&q=85'
  },
  { 
    slug: 'health', 
    name: 'Health', 
    subtitle: 'Wellness, fitness & nutrition',
    image: 'https://images.unsplash.com/photo-1676664936321-a9f0068ab7b1?crop=entropy&cs=srgb&fm=jpg&q=85'
  },
  { 
    slug: 'productivity', 
    name: 'Productivity', 
    subtitle: 'Systems & personal excellence',
    image: 'https://images.unsplash.com/photo-1653820381190-2a937abca7d2?crop=entropy&cs=srgb&fm=jpg&q=85'
  },
  { 
    slug: 'science', 
    name: 'Science', 
    subtitle: 'Scientific research & discoveries',
    image: 'https://images.unsplash.com/photo-1742206594477-15139139c0df?crop=entropy&cs=srgb&fm=jpg&q=85'
  },
  { 
    slug: 'design', 
    name: 'Design', 
    subtitle: 'Creative aesthetics & visual arts',
    image: 'https://images.unsplash.com/photo-1643722076213-aad35c684a14?crop=entropy&cs=srgb&fm=jpg&q=85'
  },
];

export default function OnboardingPage() {
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();

  const toggleTopic = (slug) => {
    setSelectedTopics(prev => {
      if (prev.includes(slug)) {
        return prev.filter(t => t !== slug);
      }
      if (prev.length >= 5) {
        toast.error('Maximum 5 topics allowed');
        return prev;
      }
      return [...prev, slug];
    });
  };

  const canContinue = selectedTopics.length >= 3 && selectedTopics.length <= 5;

  const handleContinue = async () => {
    if (!canContinue || !user) return;
    
    setIsSubmitting(true);
    try {
      const interests = selectedTopics.map(slug => {
        const topic = TOPICS.find(t => t.slug === slug);
        return {
          topic_slug: slug,
          topic_name: topic.name,
          weight: 1.0,
        };
      });

      // Use backend API to save interests (bypasses RLS)
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${backendUrl}/api/user/interests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ interests })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save interests');
      }

      await updateProfile({ onboarding_completed: true });
      
      toast.success('Your interests have been curated.');
      navigate('/feed');
    } catch (err) {
      console.error('Onboarding error:', err);
      toast.error('Failed to save interests. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] relative">
      {/* Paper texture */}
      <div className="paper-texture" />
      
      {/* Grid lines */}
      <div className="editorial-grid-lines hidden lg:flex" />

      <div className="max-w-7xl mx-auto px-6 md:px-8 py-16 md:py-24 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl mb-12 md:mb-16"
        >
          {/* Overline */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-8 md:w-12 h-px bg-[#1A1A1A]" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#6C6863]">
              Personalize Your Experience
            </p>
          </div>
          
          {/* Headline with mixed italic */}
          <h1 className="font-display text-3xl md:text-5xl lg:text-6xl leading-[0.95] tracking-tight text-[#1A1A1A] mb-4">
            What sparks your <em className="text-[#D4AF37]">curiosity</em>?
          </h1>
          
          <p className="text-base md:text-lg text-[#6C6863] leading-relaxed max-w-lg">
            Select three to five domains that captivate your mind. This curates your personalized learning journey.
          </p>
        </motion.div>

        {/* Selection Counter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex items-center gap-4 mb-8"
        >
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#6C6863]">
            Selected
          </span>
          <span className="font-display text-xl md:text-2xl text-[#1A1A1A]" data-testid="onboarding-selected-count">
            {selectedTopics.length}<span className="text-[#6C6863]">/5</span>
          </span>
          <div className="flex-1 h-px bg-[#1A1A1A]/10" />
        </motion.div>

        {/* Topics Grid with Images */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mb-12"
        >
          {TOPICS.map((topic, index) => {
            const isSelected = selectedTopics.includes(topic.slug);
            
            return (
              <motion.button
                key={topic.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 * index }}
                onClick={() => toggleTopic(topic.slug)}
                data-testid={`onboarding-topic-checkbox-${topic.slug}`}
                aria-pressed={isSelected}
                className="group relative aspect-[3/4] overflow-hidden"
              >
                {/* Background Image with Grayscale */}
                <div className="absolute inset-0">
                  <img
                    src={topic.image}
                    alt={topic.name}
                    className={`
                      w-full h-full object-cover transition-all duration-[1500ms]
                      ${isSelected ? 'grayscale-0 scale-105' : 'grayscale group-hover:grayscale-0 group-hover:scale-105'}
                    `}
                  />
                  {/* Dark overlay for text readability */}
                  <div className={`
                    absolute inset-0 transition-all duration-700
                    ${isSelected 
                      ? 'bg-gradient-to-t from-black/90 via-black/60 to-black/30' 
                      : 'bg-gradient-to-t from-black/80 via-black/40 to-transparent group-hover:from-black/70'
                    }
                  `} />
                </div>
                
                {/* Selection indicator - Gold border */}
                <div className={`
                  absolute inset-0 border-2 transition-all duration-500
                  ${isSelected ? 'border-[#D4AF37]' : 'border-transparent'}
                `} />

                {/* Checkbox indicator - top right */}
                <div className={`
                  absolute top-3 right-3 w-6 h-6 border flex items-center justify-center transition-all duration-500 z-10
                  ${isSelected 
                    ? 'bg-[#D4AF37] border-[#D4AF37]' 
                    : 'border-white/50 group-hover:border-white'
                  }
                `}>
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <Check size={14} className="text-[#1A1A1A]" strokeWidth={2} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Text content - always visible and readable */}
                <div className="absolute inset-x-0 bottom-0 p-4 md:p-5 z-10">
                  <h3 className="font-display text-xl md:text-2xl text-white mb-1">
                    {topic.name}
                  </h3>
                  <p className="text-xs md:text-sm text-white/70 leading-relaxed">
                    {topic.subtitle}
                  </p>
                </div>

                {/* Selected state - gold accent line at top */}
                {isSelected && (
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    className="absolute top-0 left-0 right-0 h-1 bg-[#D4AF37] origin-left z-10"
                  />
                )}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center gap-6"
        >
          <button
            onClick={handleContinue}
            disabled={!canContinue || isSubmitting}
            className="btn-luxury h-14 px-12 bg-[#1A1A1A] text-[#F9F8F6] uppercase text-xs tracking-[0.2em] font-medium shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-shadow duration-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
            data-testid="onboarding-continue-button"
          >
            <span>{isSubmitting ? 'Curating...' : 'Continue'}</span>
            <ArrowRight size={16} strokeWidth={1.5} />
          </button>
          
          <button
            onClick={() => navigate('/feed')}
            className="text-sm text-[#6C6863] hover:text-[#D4AF37] transition-colors duration-500 uppercase tracking-[0.15em]"
            data-testid="onboarding-skip-button"
          >
            Skip for now
          </button>
        </motion.div>

        {/* Hint */}
        <AnimatePresence>
          {selectedTopics.length > 0 && selectedTopics.length < 3 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-6 text-sm text-[#6C6863] font-display italic"
            >
              Select {3 - selectedTopics.length} more to continue
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
