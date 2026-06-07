import { createClient } from '@supabase/supabase-js';
import { config } from '../utils/config';

/**
 * Anon client — for all user-facing API routes.
 * Row Level Security is ENFORCED. Never bypass this with a user JWT.
 * Usage: pass the user's JWT via supabaseAnon.auth.setSession() or
 *        use supabaseAnon.auth.getUser(token) to verify identity.
 */
export const supabaseAnon = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_ANON_KEY
);

/**
 * Admin client — for the backend pipeline ONLY.
 * Bypasses RLS. Use in: call scheduler, call engine, brief generator,
 * brief delivery, flag handler, seed scripts.
 * NEVER use in Express routes that handle authenticated user requests.
 */
export const supabaseAdmin = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
