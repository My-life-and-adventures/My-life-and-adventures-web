import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { apiFetch } from '../../api/client';

/**
 * Where the password reset email lands.
 *
 * Supabase sends the reset link to whatever `redirectTo` the backend passed —
 * `PASSWORD_RESET_REDIRECT_URL`, which should point here. Without it (or if this
 * page is not on the Supabase redirect allowlist) Supabase quietly falls back to
 * the project's Site URL, and the link used to open the admin dashboard.
 *
 * The link comes back with the recovery session in the URL fragment
 * (`#access_token=…&type=recovery`), or with `#error=…` when it has expired or
 * was already used. The token goes straight to the backend's reset route, which
 * verifies it and sets the password; nothing is kept on this page.
 */

const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

/** Same rules as the app's sign-up form, so a reset cannot pick a weaker password. */
function passwordProblem(password: string): string | null {
  if (password.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`;
  if (password.length > MAX_LENGTH) return `Use at most ${MAX_LENGTH} characters.`;
  if (!/\p{L}/u.test(password)) return 'Include at least one letter.';
  if (!/\p{N}/u.test(password)) return 'Include at least one number.';
  if (!/[^\p{L}\p{N}]/u.test(password)) return 'Include at least one symbol, like ! or #.';
  return null;
}

interface LinkState {
  token: string | null;
  linkError: string | null;
}

/** Reads the fragment once. Supabase puts either the session or an error there. */
function readLink(): LinkState {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const error = params.get('error_description') ?? params.get('error');
  if (error) return { token: null, linkError: error.replace(/\+/g, ' ') };
  const token = params.get('access_token');
  if (!token) return { token: null, linkError: null };
  return { token, linkError: null };
}

export function ResetPasswordPage() {
  const [{ token, linkError }] = useState<LinkState>(readLink);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = 'Reset password · My Life and Adventures';
    // The token is a live session. Keep it out of the address bar, history and
    // anything the user might copy or share from here.
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const problem = useMemo(() => passwordProblem(password), [password]);
  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!token || problem || confirm !== password) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ access_token: token, new_password: password }),
      });
      setDone(true);
    } catch (err) {
      setError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const invalidLink = !token;

  return (
    <>
      <div className="viewer-hero">
        <p className="viewer-eyebrow">My Life and Adventures</p>
        <h1>{done ? 'Password updated' : 'Choose a new password'}</h1>
        <p className="viewer-subtitle">
          {done
            ? 'Open the app and sign in with your new password.'
            : invalidLink
              ? 'This reset link cannot be used.'
              : 'Enter a new password for your account.'}
        </p>
      </div>

      <div className="viewer-card">
        {done ? (
          <p className="viewer-notice">You can close this page.</p>
        ) : invalidLink ? (
          <p className="viewer-error">
            {linkError
              ? `The link has expired or was already used (${linkError}).`
              : 'The link is incomplete.'}{' '}
            Request a new one from the app: tap &ldquo;Forgot your password?&rdquo; on the sign-in
            screen.
          </p>
        ) : (
          <form onSubmit={submit} noValidate>
            {error ? <p className="viewer-error">{error}</p> : null}

            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              className="viewer-password"
              autoComplete="new-password"
              maxLength={MAX_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={submitted && problem ? true : undefined}
              aria-describedby="password-help"
              required
            />
            <p id="password-help" className={submitted && problem ? 'viewer-field-error' : 'viewer-field-hint'}>
              {submitted && problem
                ? problem
                : `At least ${MIN_LENGTH} characters, with a letter, a number and a symbol.`}
            </p>

            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              className="viewer-password"
              autoComplete="new-password"
              maxLength={MAX_LENGTH}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={(submitted || mismatch) && confirm !== password ? true : undefined}
              required
            />
            {(submitted || mismatch) && confirm !== password ? (
              <p className="viewer-field-error">The passwords do not match.</p>
            ) : null}

            <div className="viewer-actions">
              <button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save new password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
