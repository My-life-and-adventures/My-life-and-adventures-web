import { useState, type FormEvent } from 'react';
import { adminAuthConfigured, supabase } from './supabase';

/**
 * Magic-link sign-in. No password field by design: the dashboard is used rarely
 * enough that a password would end up in a manager or a note, and a link to a
 * mailbox we already trust for account recovery is no weaker.
 */
export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
        // Admins are provisioned deliberately (ADMIN_EMAILS + a Supabase user),
        // so a link request must never quietly create an account.
        shouldCreateUser: false,
      },
    });
    setBusy(false);

    if (authError) {
      setError(authError.message);
      return;
    }
    setSent(true);
  }

  if (!adminAuthConfigured) {
    return (
      <div className="viewer-card">
        <h1>Admin</h1>
        <p className="viewer-error">
          This build has no Supabase configuration. Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> and rebuild.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="viewer-hero">
        <p className="viewer-eyebrow">Admin</p>
        <h1>Sign in</h1>
        <p className="viewer-subtitle">
          We&apos;ll email you a sign-in link. Only allowlisted accounts can open the dashboard.
        </p>
      </div>
      <div className="viewer-card">
        {sent ? (
          <p className="viewer-notice">
            Check <strong>{email}</strong> for your sign-in link. It opens this page already
            signed in.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            {error ? <p className="viewer-error">{error}</p> : null}
            <label htmlFor="admin-email">Email address</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="viewer-actions">
              <button type="submit" disabled={busy || email.trim().length === 0}>
                {busy ? 'Sending…' : 'Email me a link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
