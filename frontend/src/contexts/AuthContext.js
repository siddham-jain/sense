import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Timeout wrapper for promises
const withTimeout = (promise, timeoutMs, fallback) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Session restoration timeout')), timeoutMs)
    )
  ]).catch((err) => {
    console.warn('Session check failed or timed out:', err.message);
    return fallback;
  });
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Ref to track if initial session has been handled
  const initialSessionHandled = useRef(false);
  // Ref to prevent duplicate profile fetches
  const fetchingProfile = useRef(false);

  useEffect(() => {
    let isMounted = true;
    
    // Get initial session with timeout protection
    const initializeAuth = async () => {
      try {
        // Add 5 second timeout to prevent infinite loading
        const result = await withTimeout(
          supabase.auth.getSession(),
          5000,
          { data: { session: null }, error: null }
        );
        
        if (!isMounted) return;
        
        const { data: { session: currentSession }, error: sessionError } = result;
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          // Clear potentially corrupt session data
          await supabase.auth.signOut();
          setError(sessionError.message);
        } else if (currentSession?.user) {
          setUser(currentSession.user);
          setSession(currentSession);
          // Fetch profile with timeout protection
          await fetchProfileSafe(currentSession.user.id);
        }
        
        initialSessionHandled.current = true;
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (isMounted) {
          setError(err.message);
          // Clear session on critical errors
          try {
            await supabase.auth.signOut();
          } catch (signOutErr) {
            console.error('Sign out error:', signOutErr);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;
        
        console.log('Auth event:', event);
        
        // Skip if this is the initial session and we've already handled it
        if (event === 'INITIAL_SESSION' && initialSessionHandled.current) {
          return;
        }
        
        if (newSession?.user) {
          setUser(newSession.user);
          setSession(newSession);
          await fetchProfileSafe(newSession.user.id);
        } else {
          setUser(null);
          setSession(null);
          setProfile(null);
        }
        
        // Only set loading to false if not already handled
        if (!initialSessionHandled.current) {
          setLoading(false);
          initialSessionHandled.current = true;
        }
      }
    );

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Safe profile fetch with debouncing to prevent duplicate requests
  const fetchProfileSafe = async (userId) => {
    if (fetchingProfile.current) return;
    fetchingProfile.current = true;
    
    try {
      const result = await withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        5000,
        { data: null, error: null }
      );
      
      const { data, error: profileError } = result;
      
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      fetchingProfile.current = false;
    }
  };

  // Legacy function for backward compatibility
  const fetchProfile = fetchProfileSafe;

  const signUp = async (email, password) => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const signIn = async (email, password) => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setProfile(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const updateProfile = async (updates) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      setProfile(data);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    updateProfile,
    isAuthenticated: !!user,
    hasCompletedOnboarding: profile?.onboarding_completed ?? false,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
