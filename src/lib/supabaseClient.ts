/**
 * Supabase client singleton (DAL-REQ-1).
 *
 * One client for the whole app, initialized from VITE_SUPABASE_URL and the
 * publishable key (sb_publishable_*). The publishable key is safe for the
 * browser bundle (it maps to the `anon` Postgres role); the secret key must
 * NEVER live in a VITE_ var — it would be exposed to every visitor.
 *
 * The client is created with auth session machinery disabled: this app has no
 * sign-in flow, and publishable keys cannot refresh tokens, so leaving the
 * defaults on would make the client attempt pointless gotrue calls.
 *
 * Missing env fails loudly at module load (DAL-REQ-1 "Missing env fails loudly").
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'supabaseClient requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy .env.example to .env and fill in the project URL and publishable key.',
  );
}

export const supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
