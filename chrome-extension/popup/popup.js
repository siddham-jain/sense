// Sense Extension Popup Script

const APP_URL = 'https://knowledgegraph-1.preview.emergentagent.com';

// DOM Elements
let loadingView, loginView, dashboardView;
let emailInput, passwordInput, authError, loginBtn, signupBtn;
let userEmail, collectionToggle, statusDescription;
let totalEvents, lastSync, syncBtn, openAppBtn, logoutBtn;

// State
let isAuthenticating = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  initEventListeners();
  checkAuthStatus();
});

function initElements() {
  // Views
  loadingView = document.getElementById('loading');
  loginView = document.getElementById('login-view');
  dashboardView = document.getElementById('dashboard-view');
  
  // Auth form
  emailInput = document.getElementById('email');
  passwordInput = document.getElementById('password');
  authError = document.getElementById('auth-error');
  loginBtn = document.getElementById('login-btn');
  signupBtn = document.getElementById('signup-btn');
  
  // Dashboard
  userEmail = document.getElementById('user-email');
  collectionToggle = document.getElementById('collection-toggle');
  statusDescription = document.getElementById('status-description');
  totalEvents = document.getElementById('total-events');
  lastSync = document.getElementById('last-sync');
  syncBtn = document.getElementById('sync-btn');
  openAppBtn = document.getElementById('open-app-btn');
  logoutBtn = document.getElementById('logout-btn');
}

function initEventListeners() {
  // Auth form
  document.getElementById('auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleLogin();
  });
  
  signupBtn.addEventListener('click', handleSignup);
  
  // Dashboard
  collectionToggle.addEventListener('change', handleToggleCollection);
  syncBtn.addEventListener('click', handleSync);
  openAppBtn.addEventListener('click', handleOpenApp);
  logoutBtn.addEventListener('click', handleLogout);
}

// View Management
function showView(view) {
  loadingView.classList.remove('active');
  loginView.classList.remove('active');
  dashboardView.classList.remove('active');
  view.classList.add('active');
}

// Auth Functions
async function checkAuthStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'AUTH_STATUS' });
    
    if (response.isAuthenticated) {
      showDashboard(response.user);
    } else {
      showView(loginView);
    }
  } catch (error) {
    console.error('Auth check error:', error);
    showView(loginView);
  }
}

async function handleLogin() {
  if (isAuthenticating) return;
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }
  
  isAuthenticating = true;
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';
  authError.textContent = '';
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'AUTH_SIGNIN',
      email,
      password
    });
    
    if (response.success) {
      showDashboard(response.user);
    } else {
      showError(response.error || 'Login failed');
    }
  } catch (error) {
    showError('Connection error. Please try again.');
  } finally {
    isAuthenticating = false;
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
}

async function handleSignup() {
  if (isAuthenticating) return;
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }
  
  if (password.length < 6) {
    showError('Password must be at least 6 characters');
    return;
  }
  
  isAuthenticating = true;
  signupBtn.disabled = true;
  signupBtn.textContent = 'Creating account...';
  authError.textContent = '';
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'AUTH_SIGNUP',
      email,
      password
    });
    
    if (response.success) {
      showDashboard(response.user);
    } else {
      showError(response.error || 'Signup failed');
    }
  } catch (error) {
    showError('Connection error. Please try again.');
  } finally {
    isAuthenticating = false;
    signupBtn.disabled = false;
    signupBtn.textContent = 'Create Account';
  }
}

async function handleLogout() {
  try {
    await chrome.runtime.sendMessage({ type: 'AUTH_SIGNOUT' });
    emailInput.value = '';
    passwordInput.value = '';
    showView(loginView);
  } catch (error) {
    console.error('Logout error:', error);
  }
}

function showError(message) {
  authError.textContent = message;
}

// Dashboard Functions
async function showDashboard(user) {
  showView(dashboardView);
  userEmail.textContent = user?.email || 'Unknown';
  
  // Load collection status
  const statusResponse = await chrome.runtime.sendMessage({ type: 'GET_COLLECTION_STATUS' });
  collectionToggle.checked = statusResponse.enabled;
  updateStatusDescription(statusResponse.enabled);
  
  // Load stats
  await updateStats();
}

async function updateStats() {
  try {
    const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    totalEvents.textContent = stats.total_events || 0;
    
    if (stats.last_sync) {
      const syncTime = new Date(stats.last_sync);
      const now = new Date();
      const diffMs = now - syncTime;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) {
        lastSync.textContent = 'Just now';
      } else if (diffMins < 60) {
        lastSync.textContent = `${diffMins}m ago`;
      } else {
        const diffHours = Math.floor(diffMins / 60);
        lastSync.textContent = `${diffHours}h ago`;
      }
    } else {
      lastSync.textContent = 'Never';
    }
  } catch (error) {
    console.error('Stats error:', error);
  }
}

async function handleToggleCollection() {
  const enabled = collectionToggle.checked;
  await chrome.runtime.sendMessage({ type: 'TOGGLE_COLLECTION', enabled });
  updateStatusDescription(enabled);
}

function updateStatusDescription(enabled) {
  if (enabled) {
    statusDescription.textContent = 'Capturing browsing topics to fuel your Sense graph.';
  } else {
    statusDescription.textContent = 'Collection paused. Your browsing is not being tracked.';
  }
}

async function handleSync() {
  syncBtn.disabled = true;
  syncBtn.classList.add('syncing');
  
  try {
    await chrome.runtime.sendMessage({ type: 'FORCE_SYNC' });
    await updateStats();
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    syncBtn.disabled = false;
    syncBtn.classList.remove('syncing');
  }
}

function handleOpenApp() {
  chrome.tabs.create({ url: APP_URL });
}