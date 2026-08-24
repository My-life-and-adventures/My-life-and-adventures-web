import { createContext, useContext } from 'react';

/**
 * Toast plumbing, kept apart from the components that render it.
 *
 * Split for Fast Refresh: a module exporting both components and plain values
 * loses its refresh boundary, so the context and hook live here and the
 * provider lives in ToastProvider.tsx.
 */

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  /** Optional second line — the detail worth reading but not worth a heading. */
  detail?: string;
}

export interface ToastApi {
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside a ToastProvider');
  }
  return ctx;
}
