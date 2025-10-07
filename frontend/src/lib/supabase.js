import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hmyfhmzfinidnawzyfva.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhteWZobXpmaW5pZG5hd3p5ZnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDU4MzcsImV4cCI6MjA4MTIyMTgzN30.pJcQipQsPDDoiLcp1no1N79m3zw03k0TL6jYlLoB_6s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'sense-auth',
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

export default supabase;
