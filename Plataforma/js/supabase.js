/**
 * AcolheBem — Supabase Client Initialization
 * Configure your project URL and anon key below.
 */

const SUPABASE_URL = 'https://ynsxfifbbqhstlhuilzg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DAORxweXU5vihz5HTlVzQg_LuCX1m-A';

// Initialize Supabase client (SDK loaded via CDN in index.html)
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'implicit',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: async (name, acquireTimeout, fn) => await fn(),
  }
});
