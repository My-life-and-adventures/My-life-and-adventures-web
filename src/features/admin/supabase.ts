import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase auth for the admin dashboard.
 *
 * Admins sign in with a magic link to the same Supabase project the mobile app
 * uses, so there is no separate admin account system to keep in sync. Being
 * signed in proves *who* you are and nothing more — authorization is the
 * backend's ADMIN_EMAILS allowlist, checked on every request.
 *
 * Only loaded on the /admin route (see AdminPage), so viewers never pay for
 * this bundle or hold a Supabase session they have no use for.
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** False when the build has no Supabase config — the UI then says so plainly. */
export const adminAuthConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = adminAuthConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The magic link comes back with the session in the URL fragment.
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Current access token, refreshed if it has expired. Read per request rather
 * than cached: a dashboard left open overnight would otherwise send a dead token
 * and look like a permissions failure.
 */
export async function getAdminToken(): Promise<string | null> {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
