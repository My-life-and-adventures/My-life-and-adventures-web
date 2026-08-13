/**
 * Formatting for the admin dashboard.
 *
 * Bias throughout is toward the raw value. Where a unit is genuinely hard to
 * read at a glance (milliseconds, bytes) the exact figure is still what is
 * rendered, with a converted form in parentheses — never instead of.
 */

/** `2026-08-11 18:23:44` in the reader's zone. Pair with `iso()` in a title. */
export function ts(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

/** Full precision + zone, for hover. */
export function iso(input: string): string {
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? input : d.toISOString();
}

/** Thousands separators only — no rounding, no abbreviation. */
export function num(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString();
}

export function pct(value: number, total: number, digits = 1): string {
  if (!total) return '—';
  return `${((value / total) * 100).toFixed(digits)}%`;
}

/** Exact milliseconds, with a readable equivalent once it stops being scannable. */
export function ms(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  const rounded = Math.round(value);
  if (rounded < 1000) return `${num(rounded)} ms`;
  const secs = rounded / 1000;
  if (secs < 60) return `${num(rounded)} ms (${secs.toFixed(1)}s)`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${num(rounded)} ms (${m}m ${s}s)`;
}

export function secs(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  const total = Math.round(value);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${num(total)} s (${m}m ${s}s)` : `${num(total)} s`;
}

/** Binary units, since these are file sizes off a device. */
export function bytes(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  let v = value;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return i === 0 ? `${num(value)} B` : `${num(value)} B (${v.toFixed(1)} ${units[i]})`;
}

export interface Delta {
  abs: number;
  pct: number | null;
  dir: 'up' | 'down' | 'flat';
}

/**
 * Change against the matched preceding window.
 *
 * `pct` is null when the previous window was zero: a jump from 0 to 5 is not a
 * 500% rise, it is a first occurrence, and rendering it as a percentage would
 * be actively misleading.
 */
export function delta(current: number, previous: number): Delta {
  const abs = current - previous;
  return {
    abs,
    pct: previous === 0 ? null : (abs / previous) * 100,
    dir: abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat',
  };
}

export function formatDelta(d: Delta): string {
  if (d.dir === 'flat') return '±0';
  const sign = d.abs > 0 ? '+' : '';
  const rel = d.pct == null ? 'new' : `${sign}${d.pct.toFixed(1)}%`;
  return `${sign}${num(d.abs)} (${rel})`;
}
