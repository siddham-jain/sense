// Minimal Supabase client for Chrome Extension (no external dependencies)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

class SupabaseClient {
  constructor() {
    this.url = SUPABASE_URL;
    this.key = SUPABASE_ANON_KEY;
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
  }

  async init() {
    // Load session from storage
    const stored = await chrome.storage.local.get(['sense_session', 'sense_user']);
    if (stored.sense_session) {
      this.accessToken = stored.sense_session.access_token;
      this.refreshToken = stored.sense_session.refresh_token;
      this.user = stored.sense_user;
      
      // Check if token is expired and refresh if needed
      await this.maybeRefreshToken();
    }
    return this;
  }

  getHeaders(useAuth = true) {
    const headers = {
      'apikey': this.key,
      'Content-Type': 'application/json'
    };
    if (useAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    } else {
      headers['Authorization'] = `Bearer ${this.key}`;
    }
    return headers;
  }

  async signUp(email, password) {
    const response = await fetch(`${this.url}/auth/v1/signup`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    
    if (response.ok && data.access_token) {
      await this.setSession(data);
      return { success: true, user: data.user };
    }
    
    return { success: false, error: data.error_description || data.msg || 'Signup failed' };
  }

  async signIn(email, password) {
    const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    
    if (response.ok && data.access_token) {
      await this.setSession(data);
      return { success: true, user: data.user };
    }
    
    return { success: false, error: data.error_description || data.msg || 'Login failed' };
  }

  async signOut() {
    if (this.accessToken) {
      try {
        await fetch(`${this.url}/auth/v1/logout`, {
          method: 'POST',
          headers: this.getHeaders(true)
        });
      } catch (e) {
        console.error('Logout error:', e);
      }
    }
    
    await this.clearSession();
    return { success: true };
  }

  async setSession(data) {
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.user = data.user;
    
    await chrome.storage.local.set({
      sense_session: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at || (Date.now() + (data.expires_in * 1000))
      },
      sense_user: data.user
    });
  }

  async clearSession() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    await chrome.storage.local.remove(['sense_session', 'sense_user']);
  }

  async maybeRefreshToken() {
    const stored = await chrome.storage.local.get(['sense_session']);
    if (!stored.sense_session || !stored.sense_session.refresh_token) return;

    const expiresAt = stored.sense_session.expires_at;
    const now = Date.now();
    
    // Refresh if expires in less than 5 minutes
    if (expiresAt && (expiresAt - now) < 300000) {
      await this.refreshSession();
    }
  }

  async refreshSession() {
    if (!this.refreshToken) return;

    try {
      const response = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ refresh_token: this.refreshToken })
      });

      const data = await response.json();
      
      if (response.ok && data.access_token) {
        await this.setSession(data);
      } else {
        await this.clearSession();
      }
    } catch (e) {
      console.error('Token refresh error:', e);
    }
  }

  isAuthenticated() {
    return !!this.accessToken && !!this.user;
  }

  getUser() {
    return this.user;
  }

  // Database operations
  async insert(table, data) {
    if (!this.isAuthenticated()) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${this.url}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(true),
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(data)
      });

      if (response.ok || response.status === 201) {
        return { success: true };
      }

      const error = await response.json();
      return { success: false, error: error.message || 'Insert failed' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async insertBatch(table, dataArray) {
    if (!this.isAuthenticated()) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${this.url}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(true),
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(dataArray)
      });

      if (response.ok || response.status === 201) {
        return { success: true, count: dataArray.length };
      }

      const error = await response.json();
      return { success: false, error: error.message || 'Batch insert failed' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

export const supabase = new SupabaseClient();