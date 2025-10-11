// Supabase Configuration for Sense Extension
export const SUPABASE_URL = 'https://hmyfhmzfinidnawzyfva.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhteWZobXpmaW5pZG5hd3p5ZnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDU4MzcsImV4cCI6MjA4MTIyMTgzN30.pJcQipQsPDDoiLcp1no1N79m3zw03k0TL6jYlLoB_6s';

// Batching Configuration
export const BATCH_SIZE = 10; // Number of events before flushing
export const BATCH_INTERVAL_MS = 10000; // 10 seconds
export const MIN_DWELL_MS = 3000; // Minimum 3 seconds on page to record

// Ignored domains (noise pages)
export const IGNORED_DOMAINS = [
  'google.com/search',
  'bing.com/search',
  'duckduckgo.com',
  'accounts.google.com',
  'login.',
  'signin.',
  'auth.',
  'oauth.',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'reddit.com',
  'tiktok.com',
  'youtube.com/feed',
  'linkedin.com/feed',
  'mail.google.com',
  'outlook.live.com',
  'localhost',
  'chrome://',
  'chrome-extension://'
];

// Content extraction settings
export const MAX_CONTENT_LENGTH = 5000; // Max characters to extract
export const MIN_CONTENT_LENGTH = 100; // Minimum content to be considered valuable