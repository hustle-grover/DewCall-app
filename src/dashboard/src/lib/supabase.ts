import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = (import.meta.env.VITE_SUPABASE_URL     as string | undefined) ?? ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''

// createClient is safe with empty strings at init time — auth calls will fail
// with a 400 until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set in .env
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
