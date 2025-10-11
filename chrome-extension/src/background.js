// Sense Extension - Background Service Worker
import { supabase } from './supabase-client.js';
import { BATCH_SIZE, BATCH_INTERVAL_MS, IGNORED_DOMAINS, MIN_DWELL_MS } from './config.js';

// Event queue for batching
let eventQueue = [];
let flushTimeout = null;
let collectionEnabled = true;

// Track active tabs
const activeTabs = new Map();

// Initialize
supabase.init().then(() => {
  console.log('[Sense] Background service worker initialized');
  loadSettings();
  startFlushTimer();
});

// Load settings from storage
async function loadSettings() {
  const stored = await chrome.storage.local.get(['sense_collection_enabled']);
  collectionEnabled = stored.sense_collection_enabled !== false; // Default true
}

// Start periodic flush timer
function startFlushTimer() {
  if (flushTimeout) clearInterval(flushTimeout);
  flushTimeout = setInterval(flushQueue, BATCH_INTERVAL_MS);
}

// Check if URL should be ignored
function shouldIgnoreUrl(url) {
  if (!url) return true;
  const lowerUrl = url.toLowerCase();
  return IGNORED_DOMAINS.some(domain => lowerUrl.includes(domain));
}

// Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

// Add event to queue
function queueEvent(event) {
  if (!collectionEnabled || !supabase.isAuthenticated()) return;
  
  eventQueue.push(event);
  console.log(`[Sense] Queued event (${eventQueue.length}/${BATCH_SIZE}):`, event.url?.substring(0, 50));
  
  if (eventQueue.length >= BATCH_SIZE) {
    flushQueue();
  }
}

// Flush queue to Supabase
async function flushQueue() {
  if (eventQueue.length === 0) return;
  if (!supabase.isAuthenticated()) {
    console.log('[Sense] Not authenticated, skipping flush');
    return;
  }

  const eventsToSend = [...eventQueue];
  eventQueue = [];

  console.log(`[Sense] Flushing ${eventsToSend.length} events to Supabase...`);

  try {
    const result = await supabase.insertBatch('browsing_history', eventsToSend);
    
    if (result.success) {
      console.log(`[Sense] Successfully sent ${eventsToSend.length} events`);
      // Update stats
      const stats = await chrome.storage.local.get(['sense_stats']);
      const currentStats = stats.sense_stats || { total_events: 0, last_sync: null };
      currentStats.total_events += eventsToSend.length;
      currentStats.last_sync = new Date().toISOString();
      await chrome.storage.local.set({ sense_stats: currentStats });
    } else {
      console.error('[Sense] Failed to send events:', result.error);
      // Put events back in queue on failure
      eventQueue = [...eventsToSend, ...eventQueue];
    }
  } catch (error) {
    console.error('[Sense] Flush error:', error);
    eventQueue = [...eventsToSend, ...eventQueue];
  }
}

// Handle tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url && !shouldIgnoreUrl(tab.url)) {
    activeTabs.set(activeInfo.tabId, {
      url: tab.url,
      title: tab.title,
      startedAt: Date.now()
    });
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !shouldIgnoreUrl(tab.url)) {
    // Record previous page visit if exists
    const previous = activeTabs.get(tabId);
    if (previous && previous.url !== tab.url) {
      recordVisit(tabId, previous);
    }
    
    // Start tracking new page
    activeTabs.set(tabId, {
      url: tab.url,
      title: tab.title,
      startedAt: Date.now()
    });
  }
});

// Handle tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  const tabData = activeTabs.get(tabId);
  if (tabData) {
    recordVisit(tabId, tabData);
    activeTabs.delete(tabId);
  }
});

// Record a page visit
function recordVisit(tabId, tabData) {
  if (!supabase.isAuthenticated()) return;
  
  const dwellMs = Date.now() - tabData.startedAt;
  
  // Only record if spent enough time on page
  if (dwellMs < MIN_DWELL_MS) return;
  
  const event = {
    user_id: supabase.getUser()?.id,
    url: tabData.url,
    title: tabData.title || '',
    domain: extractDomain(tabData.url),
    started_at: new Date(tabData.startedAt).toISOString(),
    ended_at: new Date().toISOString(),
    dwell_ms: dwellMs,
    scroll_depth: tabData.scrollDepth || 0,
    content: tabData.content || {},
    entities: tabData.entities || [],
    keyphrases: tabData.keyphrases || [],
    meta: {
      viewport: tabData.viewport || null,
      referrer: tabData.referrer || null
    }
  };
  
  queueEvent(event);
}

// Message handler for content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'CONTENT_DATA':
      // Update tab data with content script data
      if (sender.tab?.id && activeTabs.has(sender.tab.id)) {
        const tabData = activeTabs.get(sender.tab.id);
        tabData.content = message.content || {};
        tabData.entities = message.entities || [];
        tabData.keyphrases = message.keyphrases || [];
        tabData.scrollDepth = message.scrollDepth || 0;
        tabData.viewport = message.viewport || null;
        tabData.referrer = message.referrer || null;
        activeTabs.set(sender.tab.id, tabData);
      }
      return { success: true };

    case 'AUTH_SIGNUP':
      const signupResult = await supabase.signUp(message.email, message.password);
      return signupResult;

    case 'AUTH_SIGNIN':
      const signinResult = await supabase.signIn(message.email, message.password);
      return signinResult;

    case 'AUTH_SIGNOUT':
      const signoutResult = await supabase.signOut();
      return signoutResult;

    case 'AUTH_STATUS':
      await supabase.init();
      return {
        isAuthenticated: supabase.isAuthenticated(),
        user: supabase.getUser()
      };

    case 'GET_STATS':
      const stats = await chrome.storage.local.get(['sense_stats']);
      return stats.sense_stats || { total_events: 0, last_sync: null };

    case 'TOGGLE_COLLECTION':
      collectionEnabled = message.enabled;
      await chrome.storage.local.set({ sense_collection_enabled: collectionEnabled });
      return { success: true, enabled: collectionEnabled };

    case 'GET_COLLECTION_STATUS':
      return { enabled: collectionEnabled };

    case 'FORCE_SYNC':
      await flushQueue();
      return { success: true };

    default:
      return { error: 'Unknown message type' };
  }
}

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Sense] Extension installed');
    chrome.storage.local.set({
      sense_collection_enabled: true,
      sense_stats: { total_events: 0, last_sync: null }
    });
  }
});