import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchAdminMe, fetchPromoDashboard, type PromoDashboard } from '../../api/admin';
import { ToastProvider } from '../../components/ToastProvider';
import { AdminLogin } from './AdminLogin';
import { Balances } from './Balances';
import { Promos } from './Promos';
import { adminAuthConfigured, supabase } from './supabase';
import './admin.css';

/**
 * Admin dashboard shell.
 *
 * Two gates, deliberately: Supabase says who you are, then `/admin/me` asks the
 * backend whether that account is on the ADMIN_EMAILS allowlist. The second one
 * is the real check — this component only decides what to render, and every data
 * request is authorized server-side regardless of what it decides.
 */

/** Result of the allowlist check, tagged with the user it was made for. */
interface AdminCheck {
  userId: string;
  email?: string;
}

export function AdminPage() {
  // `undefined` = not yet known, `null` = definitely signed out. The difference
  // matters: showing the login form during the initial read would make a magic
  // link look like it had failed.
  const [session, setSession] = useState<Session | null | undefined>(
    adminAuthConfigured ? undefined : null,
  );
  const [check, setCheck] = useState<AdminCheck | null>(null);
  const [tab, setTab] = useState<'balances' | 'codes'>('balances');
  const [dashboard, setDashboard] = useState<PromoDashboard | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    // Fires when the magic link lands and when a refresh fails, so the UI
    // follows the session rather than a snapshot taken at mount.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchAdminMe()
      .then((me) => {
        if (!cancelled) setCheck({ userId, email: me.email });
      })
      .catch(() => {
        // Denied: recorded against this user id so a later sign-in re-checks
        // rather than inheriting the previous account's verdict.
        if (!cancelled) setCheck({ userId });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Loaded once the allowlist check passes, and re-read whenever a payout moves
  // money, so the owed figures can never lag the action that changed them.
  useEffect(() => {
    if (!check?.email) return;
    let cancelled = false;
    fetchPromoDashboard()
      .then((d) => {
        if (!cancelled) setDashboard(d);
      })
      .catch(() => {
        if (!cancelled) setDashboard(null);
      });
    return () => {
      cancelled = true;
    };
  }, [check?.email, reloadKey]);

  if (!adminAuthConfigured || session === null) return <AdminLogin />;

  // A check that belongs to a different user id is a stale verdict, not an answer.
  const verdict = check?.userId === userId ? check : null;
  if (session === undefined || !verdict) return <p className="admin-muted">Checking access…</p>;

  if (!verdict.email) {
    return (
      <div className="viewer-card">
        <h1>Not an admin</h1>
        <p className="viewer-error">
          This account isn&apos;t on the admin allowlist. Ask for it to be added to{' '}
          <code>ADMIN_EMAILS</code> on the backend.
        </p>
        <div className="viewer-actions">
          <button type="button" onClick={() => void supabase?.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="admin-page">
        <header className="admin-header">
          <div>
            <p className="viewer-eyebrow">Admin</p>
            <h1>Promo codes</h1>
          </div>
          <div className="admin-header-actions">
            <span className="admin-muted">{verdict.email}</span>
            <button
              type="button"
              className="admin-btn-quiet"
              onClick={() => void supabase?.auth.signOut()}
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="admin-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'balances'}
            className={tab === 'balances' ? 'admin-tab admin-tab-on' : 'admin-tab'}
            onClick={() => setTab('balances')}
          >
            Money
          </button>
          <button
            role="tab"
            aria-selected={tab === 'codes'}
            className={tab === 'codes' ? 'admin-tab admin-tab-on' : 'admin-tab'}
            onClick={() => setTab('codes')}
          >
            Codes &amp; resellers
          </button>
        </div>

        {tab === 'balances' ? (
          dashboard ? (
            <Balances dashboard={dashboard} onChanged={() => setReloadKey((k) => k + 1)} />
          ) : (
            <p className="admin-muted">Loading…</p>
          )
        ) : (
          <Promos onChanged={() => setReloadKey((k) => k + 1)} />
        )}
      </div>
    </ToastProvider>
  );
}
