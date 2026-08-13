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
 * Where a magic link should land.
 *
 * Prefers an explicitly configured canonical origin over wherever this page
 * happens to be served from. That matters for two cases `window.location.origin`
 * gets wrong:
 *
 *  - Vercel preview deploys get a fresh random hostname per deploy, which can
 *    never be on Supabase's redirect allowlist.
 *  - Any origin that is not allowlisted is not rejected — Supabase quietly
 *    substitutes the project's Site URL instead, so the link arrives pointing
 *    somewhere unrelated and the cause is invisible from the app.
 *
 * Whatever this resolves to must be listed under Authentication → URL
 * Configuration → Redirect URLs in the Supabase dashboard, or the fallback above
 * applies.
 */
export function adminRedirectUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL?.trim();
  const origin = configured ? configured.replace(/\/+$/, '') : window.location.origin;
  return `${origin}/admin`;
}

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
