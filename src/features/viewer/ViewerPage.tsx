import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiClientError } from '../../api/client';
import type { ViewerInvitePreview, ViewerProfile, ViewerStory } from '../../api/types';
import { clearSessionToken } from '../../api/session';
import * as viewerApi from '../../api/viewer';
import { OtpForm } from './OtpForm';
import { StoriesList } from './StoriesList';
import './viewer.css';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'error'; message: string }
  | { kind: 'otp'; preview: ViewerInvitePreview; token: string; notice?: string; error?: string }
  | { kind: 'stories'; profile: ViewerProfile; stories: ViewerStory[] };

export function ViewerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  const loadStories = useCallback(async () => {
    const [profile, stories] = await Promise.all([
      viewerApi.getViewerMe(),
      viewerApi.listViewerStories(),
    ]);
    setState({ kind: 'stories', profile, stories });
  }, []);

  const startInviteFlow = useCallback(async (inviteToken: string) => {
    const preview = await viewerApi.getInvitePreview(inviteToken);
    const sent = await viewerApi.requestLoginCode(inviteToken);
    const notice = sent.sent
      ? `We sent a sign-in code to ${preview.masked_email}.`
      : `A code was already sent recently to ${preview.masked_email}. Check your inbox or resend below.`;
    setState({ kind: 'otp', preview, token: inviteToken, notice });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        if (token) {
          try {
            const [profile, stories] = await Promise.all([
              viewerApi.getViewerMe(),
              viewerApi.listViewerStories(),
            ]);
            if (!cancelled) {
              setState({ kind: 'stories', profile, stories });
              navigate('/viewer', { replace: true });
            }
            return;
          } catch {
            // No session yet — continue with invite flow.
          }
          await startInviteFlow(token);
          return;
        }

        await loadStories();
      } catch (err) {
        if (cancelled) return;
        // Someone who opens the portal directly has no invite token and no session, so the
        // API answers 401. That is an ordinary first visit, not a failure: show the welcome
        // card rather than an error, and drop a session token that has simply expired.
        if (err instanceof ApiClientError && err.status === 401) {
          clearSessionToken();
          setState({ kind: 'signedOut' });
          return;
        }
        const message =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Something went wrong.';
        setState({ kind: 'error', message });
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [token, loadStories, startInviteFlow, navigate]);

  async function handleVerify(code: string) {
    if (state.kind !== 'otp') return;
    setBusy(true);
    try {
      await viewerApi.verifyLoginCode(state.token, code);
      await loadStories();
      navigate('/viewer', { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Something went wrong.';
      setState({ ...state, error: message });
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (state.kind !== 'otp') return;
    setBusy(true);
    try {
      const sent = await viewerApi.requestLoginCode(state.token);
      const notice = sent.sent
        ? `A new code was sent to ${state.preview.masked_email}.`
        : `Please wait a minute before requesting another code. Check ${state.preview.masked_email} for the latest message.`;
      setState({ ...state, notice, error: undefined });
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Something went wrong.';
      setState({ ...state, error: message });
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === 'loading') {
    return (
      <div className="viewer-loading" role="status" aria-live="polite">
        <div className="viewer-spinner" aria-hidden="true" />
        <p>Loading your stories…</p>
      </div>
    );
  }

  if (state.kind === 'signedOut') {
    return (
      <div className="viewer-card viewer-welcome">
        <p className="viewer-eyebrow">My Life &amp; Adventures</p>
        <h1>Your stories live here</h1>
        <p className="viewer-subtitle">
          When someone records a story for you, we email you a private link. Open that link
          and we will send a sign-in code &mdash; there is no account or password to remember.
        </p>
        <p className="viewer-meta">
          Been here before? Sign-ins expire after a while to keep your stories private. Open
          the most recent email link again to pick up where you left off.
        </p>
        <p className="viewer-meta">
          Lost your link or need a hand? <Link to="/support">Visit support</Link>.
        </p>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="viewer-card">
        <p className="viewer-eyebrow">Something went wrong</p>
        <h1>Unable to open stories</h1>
        <p className="viewer-error">{state.message}</p>
      </div>
    );
  }

  if (state.kind === 'otp') {
    return (
      <OtpForm
        preview={state.preview}
        token={state.token}
        notice={state.notice}
        error={state.error}
        busy={busy}
        onVerify={handleVerify}
        onResend={handleResend}
      />
    );
  }

  return (
    <StoriesList
      fullName={state.profile.full_name}
      storytellerName={state.profile.storyteller_name}
      stories={state.stories}
    />
  );
}
