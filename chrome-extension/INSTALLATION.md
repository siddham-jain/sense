# Sense Chrome Extension - Installation Guide

## Overview
The Sense Chrome Extension passively captures your browsing activity to build your personalized knowledge graph. It collects:
- URLs and page titles
- Time spent on pages (dwell time)
- Scroll depth
- Main content text
- Key phrases and entities

## Installation Steps

### 1. Download the Extension
The extension is located in `/app/chrome-extension/`

If you're accessing this remotely, download the entire `chrome-extension` folder to your local machine.

### 2. Generate Extension Icons
Before loading the extension, you need icons. Create simple placeholder icons:

```bash
# Navigate to the extension directory
cd chrome-extension/icons

# The icons should be PNG files: icon16.png, icon48.png, icon128.png
# For testing, you can use any square images or create them
```

Alternatively, you can create them using an online tool or use the placeholder icons provided.

### 3. Load as Unpacked Extension in Chrome

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **"Load unpacked"** button
5. Select the `chrome-extension` folder
6. The Sense extension should now appear in your extensions list

### 4. Pin the Extension (Optional)
1. Click the puzzle piece icon in Chrome toolbar
2. Find "Sense - Learning Signal Collector"
3. Click the pin icon to keep it visible

### 5. Sign In or Create Account
1. Click the Sense extension icon in toolbar
2. Enter your email and password
3. Click "Sign In" or "Create Account" if you're new

### 6. Start Browsing!
Once signed in, the extension will automatically:
- Track pages you visit (excluding noise like social feeds, login pages)
- Extract key content and entities
- Batch and sync data to your Sense knowledge graph

## Features

### Collection Toggle
You can pause/resume collection at any time from the extension popup.

### Manual Sync
Click "Sync Now" to immediately upload any pending browsing data.

### Open Sense App
Click "Open Sense App" to view your personalized video feed and knowledge graph.

## Privacy

### What We Collect
- URLs of pages you visit (excluding filtered domains)
- Page titles
- Time spent on each page
- How far you scrolled
- Main text content (truncated)
- Extracted entities and key phrases

### What We DON'T Collect
- Passwords or form inputs
- Private/incognito browsing
- Content from filtered domains (social media, email, login pages, etc.)
- Any data when collection is paused

### Filtered Domains
The extension automatically ignores:
- Search engines (Google, Bing, DuckDuckGo)
- Social media (Facebook, Twitter, Instagram, Reddit, TikTok)
- Email (Gmail, Outlook)
- Login/auth pages
- YouTube feeds
- LinkedIn feeds
- Localhost and browser pages

## Troubleshooting

### Extension Not Working
1. Check that you're signed in (click the extension icon)
2. Verify collection is enabled (toggle should be ON)
3. Check Chrome console for errors (`chrome://extensions/` → Sense → "Inspect views: service worker")

### Data Not Syncing
1. Click "Sync Now" to force a sync
2. Check your internet connection
3. Verify you're signed in with valid credentials

### Pages Not Being Tracked
- The page may be on the filtered domains list
- You may not have spent enough time on the page (minimum 3 seconds)
- The page may not have enough content (minimum 100 characters)

## Technical Details

- **Manifest Version**: 3 (latest)
- **Permissions**: storage, tabs, activeTab, scripting
- **Backend**: Supabase (PostgreSQL + Auth)
- **Batching**: Events are batched (10 events or 10 seconds) before syncing

## Support

For issues or questions, contact support through the Sense web app.