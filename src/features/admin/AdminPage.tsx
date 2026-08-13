import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchAdminMe } from '../../api/admin';
import { AdminLogin } from './AdminLogin';
import { EventStream } from './EventStream';
import { Overview } from './Overview';
import { adminAuthConfigured, supabase } from './supabase';
import './admin.css';

/**
 * Admin dashboard for our first-party analytics.
 *
 * Two gates, deliberately: Supabase says who you are, then `/admin/me` asks the
 * backend whether that account is on the ADMIN_EMAILS allowlist. The second one
 * is the real check — this component only decides what to render, and every data
 * request is authorized server-side regardless of what it decides.
 */

const WINDOWS = [
  { hours: 24, label: '24 hours' },
  { hours: 24 * 7, label: '7 days' },
  { hours: 24 * 30, label: '30 days' },
];

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
  const [tab, setTab] = useState<'overview' | 'stream'>('overview');
  const [windowHours, setWindowHours] = useState(24);
  const [refreshKey, setRefreshKey] = useState(0);
  const [focusedEvent, setFocusedEvent] = useState<string | undefined>();

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

  const openEvent = useCallback((name: string) => {
    setFocusedEvent(name);
    setTab('stream');
  }, []);

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
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p className="viewer-eyebrow">Admin</p>
          <h1>Analytics</h1>
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

      <div className="admin-toolbar">
        <div className="admin-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'overview'}
            className={tab === 'overview' ? 'admin-tab admin-tab-on' : 'admin-tab'}
            onClick={() => setTab('overview')}
          >
            Metrics
          </button>
          <button
            role="tab"
            aria-selected={tab === 'stream'}
            className={tab === 'stream' ? 'admin-tab admin-tab-on' : 'admin-tab'}
            onClick={() => setTab('stream')}
          >
            app_events
          </button>
        </div>

        <div className="admin-toolbar-right">
          <select
            aria-label="Time window"
            value={windowHours}
            onChange={(e) => setWindowHours(Number(e.target.value))}
          >
            {WINDOWS.map((w) => (
              <option key={w.hours} value={w.hours}>
                Last {w.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="admin-btn-quiet"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            Refresh
          </button>
        </div>
      </div>

      {tab === 'overview' ? (
        <Overview windowHours={windowHours} refreshKey={refreshKey} onSelectEvent={openEvent} />
      ) : (
        // Keyed on the focused event so arriving from the overview remounts with
        // that filter applied, rather than syncing a prop into state.
        <EventStream
          key={focusedEvent ?? 'all'}
          windowHours={windowHours}
          refreshKey={refreshKey}
          initialName={focusedEvent}
        />
      )}
    </div>
  );
}
