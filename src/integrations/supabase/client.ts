import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Keep the public landing page usable when the repo is previewed locally
// without a Supabase project configured. Auth/data features still require the
// real values from .env.local.
const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
const supabaseUrl = SUPABASE_URL || 'https://preview.supabase.co';
const supabaseKey = SUPABASE_PUBLISHABLE_KEY || 'preview-anon-key';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export { isSupabaseConfigured };

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
