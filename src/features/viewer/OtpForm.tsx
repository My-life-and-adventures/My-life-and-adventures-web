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
        <h1>Verify your email</h1>
        <p className="viewer-subtitle">
          Hello {preview.full_name}, enter the 6-digit code we sent to{' '}
          <strong>{preview.masked_email}</strong> to view stories from {preview.storyteller_name}.
        </p>
      </div>
      <div className="viewer-card">
        {notice ? <p className="viewer-notice">{notice}</p> : null}
        {error ? <p className="viewer-error">{error}</p> : null}
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="token" value={token} />
          <label htmlFor="code">Sign-in code</label>
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
          />
          <div className="viewer-actions">
            <button type="submit" disabled={busy || code.length !== 6}>
              {busy ? 'Checking…' : 'Continue'}
            </button>
          </div>
        </form>
        <div className="viewer-actions" style={{ marginTop: 16 }}>
          <button type="button" className="viewer-btn-secondary" disabled={busy} onClick={() => onResend()}>
            Resend code
          </button>
        </div>
      </div>
    </>
  );
}
