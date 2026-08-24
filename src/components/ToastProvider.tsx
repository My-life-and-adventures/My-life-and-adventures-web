import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type Toast, type ToastApi, type ToastVariant } from './toast-context';
import './toast.css';

/**
 * Transient confirmations for actions that would otherwise complete silently.
 *
 * Deliberately not used for anything the reader might need later: a toast that
 * carries the only copy of an identifier is a toast that loses it. Details worth
 * keeping stay on the page.
 */

/** Long enough to read a short sentence without rushing, short enough to ignore. */
const DISMISS_MS = 5000;

/** Older toasts are dropped rather than stacking into a wall. */
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, title: string, detail?: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, variant, title, detail }].slice(-MAX_VISIBLE));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_MS),
      );
    },
    [dismiss],
  );

  // Stable identity so consumers can depend on it without re-running effects.
  const api = useMemo<ToastApi>(
    () => ({
      success: (title, detail) => push('success', title, detail),
      error: (title, detail) => push('error', title, detail),
      info: (title, detail) => push('info', title, detail),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/*
        aria-live rather than role="alert": these are confirmations of something
        the user just did, so they should be announced without interrupting.
      */}
      <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.variant}`}>
            <span className="toast-icon" aria-hidden="true">
              {toast.variant === 'success' ? '✓' : toast.variant === 'error' ? '!' : 'i'}
            </span>
            <div className="toast-body">
              <p className="toast-title">{toast.title}</p>
              {toast.detail ? <p className="toast-detail">{toast.detail}</p> : null}
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
