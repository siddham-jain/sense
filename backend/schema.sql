
-- ============================================
-- SENSE PLATFORM DATABASE SCHEMA
-- Future-proof design with JSONB for flexibility
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES TABLE
-- Extends auth.users with app-specific data
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- 2. INTERESTS TABLE
-- User's selected topics during onboarding
-- ============================================
CREATE TABLE IF NOT EXISTS public.interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_slug TEXT NOT NULL,
    topic_name TEXT NOT NULL,
    weight FLOAT DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, topic_slug)
);

-- Enable RLS
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for interests
DROP POLICY IF EXISTS "Users can view own interests" ON public.interests;
CREATE POLICY "Users can view own interests" ON public.interests
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own interests" ON public.interests;
CREATE POLICY "Users can insert own interests" ON public.interests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own interests" ON public.interests;
CREATE POLICY "Users can update own interests" ON public.interests
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own interests" ON public.interests;
CREATE POLICY "Users can delete own interests" ON public.interests
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. BROWSING HISTORY TABLE
-- Raw browsing signals from Chrome extension
-- ============================================
CREATE TABLE IF NOT EXISTS public.browsing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    domain TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    dwell_ms INTEGER DEFAULT 0,
    scroll_depth FLOAT DEFAULT 0,
    content JSONB DEFAULT '{}',
    entities JSONB DEFAULT '[]',
    keyphrases JSONB DEFAULT '[]',
    meta JSONB DEFAULT '{}',
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.browsing_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for browsing_history
DROP POLICY IF EXISTS "Users can view own history" ON public.browsing_history;
CREATE POLICY "Users can view own history" ON public.browsing_history
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own history" ON public.browsing_history;
CREATE POLICY "Users can insert own history" ON public.browsing_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for browsing_history
CREATE INDEX IF NOT EXISTS idx_browsing_history_user_id ON public.browsing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_browsing_history_created_at ON public.browsing_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_browsing_history_domain ON public.browsing_history(domain);

-- ============================================
-- 4. ANCHORS TABLE
-- Stabilized concepts extracted from browsing
-- ============================================
CREATE TABLE IF NOT EXISTS public.anchors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    anchor TEXT NOT NULL,
    anchor_type TEXT DEFAULT 'concept',
    frequency INTEGER DEFAULT 1,
    recency_score FLOAT DEFAULT 1.0,
    stats JSONB DEFAULT '{}',
    sources JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, anchor)
);

-- Enable RLS
ALTER TABLE public.anchors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for anchors
DROP POLICY IF EXISTS "Users can view own anchors" ON public.anchors;
CREATE POLICY "Users can view own anchors" ON public.anchors
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own anchors" ON public.anchors;
CREATE POLICY "Users can manage own anchors" ON public.anchors
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 5. KNOWLEDGE GRAPH NODES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.knowledge_graph_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    kind TEXT DEFAULT 'concept',
    frequency INTEGER DEFAULT 1,
    attrs JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, label)
);

-- Enable RLS
ALTER TABLE public.knowledge_graph_nodes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for knowledge_graph_nodes
DROP POLICY IF EXISTS "Users can view own graph nodes" ON public.knowledge_graph_nodes;
CREATE POLICY "Users can view own graph nodes" ON public.knowledge_graph_nodes
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own graph nodes" ON public.knowledge_graph_nodes;
CREATE POLICY "Users can manage own graph nodes" ON public.knowledge_graph_nodes
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 6. KNOWLEDGE GRAPH EDGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.knowledge_graph_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES public.knowledge_graph_nodes(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.knowledge_graph_nodes(id) ON DELETE CASCADE,
    relation TEXT DEFAULT 'related_to',
    weight FLOAT DEFAULT 1.0,
    attrs JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, source_id, target_id)
);

-- Enable RLS
ALTER TABLE public.knowledge_graph_edges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for knowledge_graph_edges
DROP POLICY IF EXISTS "Users can view own graph edges" ON public.knowledge_graph_edges;
CREATE POLICY "Users can view own graph edges" ON public.knowledge_graph_edges
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own graph edges" ON public.knowledge_graph_edges;
CREATE POLICY "Users can manage own graph edges" ON public.knowledge_graph_edges
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 7. VIDEOS TABLE (Public content)
-- ============================================
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    src TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_ms INTEGER,
    provider TEXT DEFAULT 'seeded',
    topics JSONB DEFAULT '[]',
    meta JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS but allow public read
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for videos (public read)
DROP POLICY IF EXISTS "Anyone can view active videos" ON public.videos;
CREATE POLICY "Anyone can view active videos" ON public.videos
    FOR SELECT USING (is_active = TRUE);

-- ============================================
-- 8. FEED ITEMS TABLE
-- Personalized feed entries for each user
-- ============================================
CREATE TABLE IF NOT EXISTS public.feed_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    reason JSONB DEFAULT '{}',
    rank_score FLOAT DEFAULT 0,
    viewed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.feed_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feed_items
DROP POLICY IF EXISTS "Users can view own feed" ON public.feed_items;
CREATE POLICY "Users can view own feed" ON public.feed_items
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own feed" ON public.feed_items;
CREATE POLICY "Users can manage own feed" ON public.feed_items
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 9. FEED INTERACTIONS TABLE
-- User interactions with feed content
-- ============================================
CREATE TABLE IF NOT EXISTS public.feed_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    value JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.feed_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feed_interactions
DROP POLICY IF EXISTS "Users can view own interactions" ON public.feed_interactions;
CREATE POLICY "Users can view own interactions" ON public.feed_interactions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own interactions" ON public.feed_interactions;
CREATE POLICY "Users can insert own interactions" ON public.feed_interactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_feed_interactions_user_video ON public.feed_interactions(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_feed_interactions_action ON public.feed_interactions(action);

-- ============================================
-- 10. FUNCTION: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, created_at, updated_at)
    VALUES (NEW.id, NEW.email, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Schema setup completed successfully!' as status;
