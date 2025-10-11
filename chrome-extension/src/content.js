// Sense Extension - Content Script
// Extracts content and signals from web pages

(function() {
  'use strict';

  const MAX_CONTENT_LENGTH = 5000;
  const MIN_CONTENT_LENGTH = 100;
  const DEBOUNCE_MS = 500;
  
  let lastScrollDepth = 0;
  let scrollTimeout = null;
  let hasExtracted = false;

  // Simple entity extraction (deterministic, no LLM)
  function extractEntities(text) {
    const entities = [];
    
    // Extract potential company/product names (capitalized words)
    const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    const capitalized = text.match(capitalizedPattern) || [];
    
    // Filter common words and dedupe
    const commonWords = new Set(['The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where', 'Which', 'Who', 'How', 'And', 'But', 'For', 'With', 'From', 'About', 'Into', 'Through', 'During', 'Before', 'After', 'Above', 'Below', 'Between', 'Under', 'Again', 'Further', 'Then', 'Once', 'Here', 'There', 'All', 'Each', 'Few', 'More', 'Most', 'Other', 'Some', 'Such', 'Only', 'Own', 'Same', 'Than', 'Too', 'Very', 'Just', 'Should', 'Now', 'Also', 'New', 'First', 'Last', 'Long', 'Great', 'Little', 'Good', 'High', 'Old', 'Big', 'Small', 'Large', 'Next', 'Early', 'Young', 'Important', 'Public', 'Bad', 'Right', 'Social', 'National', 'Best', 'Free', 'True', 'Full', 'Special', 'Sure', 'Clear', 'Recent', 'Likely', 'Simply', 'General', 'Specific']);
    
    const seen = new Set();
    for (const match of capitalized) {
      const trimmed = match.trim();
      if (trimmed.length >= 2 && !commonWords.has(trimmed) && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        entities.push({ text: trimmed, type: 'entity' });
      }
    }
    
    // Limit entities
    return entities.slice(0, 20);
  }

  // Extract key phrases (noun phrases, compound terms)
  function extractKeyphrases(text) {
    const keyphrases = [];
    
    // Extract compound terms (adjective + noun patterns)
    const compoundPattern = /\b([a-z]+(?:\s+[a-z]+){1,3})\b/gi;
    const compounds = text.match(compoundPattern) || [];
    
    // Filter and dedupe
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there']);
    
    const seen = new Set();
    for (const match of compounds) {
      const words = match.toLowerCase().split(/\s+/);
      // Skip if all words are stop words
      if (words.every(w => stopWords.has(w))) continue;
      
      const phrase = words.join(' ');
      if (phrase.length >= 4 && !seen.has(phrase)) {
        seen.add(phrase);
        keyphrases.push(phrase);
      }
    }
    
    // Sort by length (longer phrases tend to be more specific)
    keyphrases.sort((a, b) => b.length - a.length);
    
    return keyphrases.slice(0, 15);
  }

  // Extract main content from page
  function extractContent() {
    // Try to find main content area
    const selectors = [
      'article',
      '[role="main"]',
      'main',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      '#content',
      '.post',
      '.article'
    ];
    
    let contentElement = null;
    for (const selector of selectors) {
      contentElement = document.querySelector(selector);
      if (contentElement) break;
    }
    
    // Fallback to body
    if (!contentElement) {
      contentElement = document.body;
    }
    
    // Clone and clean
    const clone = contentElement.cloneNode(true);
    
    // Remove unwanted elements
    const removeSelectors = ['script', 'style', 'nav', 'header', 'footer', 'aside', '.sidebar', '.comments', '.advertisement', '.ad', '[role="banner"]', '[role="navigation"]', '[role="complementary"]'];
    removeSelectors.forEach(sel => {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    });
    
    // Get text content
    let text = clone.textContent || '';
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Truncate if too long
    if (text.length > MAX_CONTENT_LENGTH) {
      text = text.substring(0, MAX_CONTENT_LENGTH) + '...';
    }
    
    return text;
  }

  // Get scroll depth percentage
  function getScrollDepth() {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollHeight <= 0) return 100;
    const scrolled = window.scrollY;
    return Math.min(100, Math.round((scrolled / scrollHeight) * 100));
  }

  // Send data to background script
  function sendContentData() {
    const content = extractContent();
    
    // Skip if content is too short (likely not a content page)
    if (content.length < MIN_CONTENT_LENGTH) {
      console.log('[Sense] Content too short, skipping extraction');
      return;
    }
    
    const entities = extractEntities(content);
    const keyphrases = extractKeyphrases(content);
    
    const data = {
      type: 'CONTENT_DATA',
      content: {
        text: content.substring(0, 1000), // Send truncated for storage
        length: content.length
      },
      entities: entities,
      keyphrases: keyphrases,
      scrollDepth: lastScrollDepth,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      referrer: document.referrer || null
    };
    
    chrome.runtime.sendMessage(data).catch(err => {
      // Extension context may be invalidated, ignore
    });
    
    hasExtracted = true;
  }

  // Debounced scroll handler
  function handleScroll() {
    lastScrollDepth = getScrollDepth();
    
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (hasExtracted) {
        // Update scroll depth
        chrome.runtime.sendMessage({
          type: 'CONTENT_DATA',
          scrollDepth: lastScrollDepth
        }).catch(() => {});
      }
    }, DEBOUNCE_MS);
  }

  // Initialize
  function init() {
    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(sendContentData, 1000);
      });
    } else {
      setTimeout(sendContentData, 1000);
    }
    
    // Track scroll
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Send final data before unload
    window.addEventListener('beforeunload', () => {
      if (hasExtracted) {
        chrome.runtime.sendMessage({
          type: 'CONTENT_DATA',
          scrollDepth: lastScrollDepth
        }).catch(() => {});
      }
    });
  }

  init();
})();