import { useState, type FormEvent } from 'react';
import type { ViewerInvitePreview } from '../../api/types';

interface OtpFormProps {
  preview: ViewerInvitePreview;
  token: string;
  notice?: string;
  error?: string;
  busy?: boolean;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
}

export function OtpForm({
  preview,
  token,
  notice,
  error,
  busy = false,
  onVerify,
  onResend,
}: OtpFormProps) {
  const [code, setCode] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onVerify(code.trim());
  }

  return (
    <>
      <div className="viewer-hero">
        <p className="viewer-eyebrow">Sign-in code</p>
        <h1>Verify your email</h1>
        <p className="viewer-subtitle">
          Hello <strong>{preview.full_name}</strong>, enter the 6-digit code we sent to{' '}
          <strong>{preview.masked_email}</strong> to view stories from{' '}
          <strong>{preview.storyteller_name}</strong>.
        </p>
      </div>
      <div className="viewer-card">
        {notice ? <p className="viewer-notice">{notice}</p> : null}
        {error ? <p className="viewer-error">{error}</p> : null}
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="token" value={token} />
          <label htmlFor="code">Your code</label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-describedby="code-hint"
          />
          <p id="code-hint" className="viewer-meta" style={{ marginTop: 10, marginBottom: 0 }}>
            The code expires in 15 minutes.
          </p>
          <div className="viewer-actions">
            <button type="submit" disabled={busy || code.length !== 6}>
              {busy ? 'Checking…' : 'Continue'}
            </button>
            <button
              type="button"
              className="viewer-btn-secondary"
              disabled={busy}
              onClick={() => onResend()}
            >
              Resend code
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
