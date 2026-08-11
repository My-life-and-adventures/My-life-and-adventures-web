import { apiFetch } from './client';
import { getAdminToken } from '../features/admin/supabase';

/**
 * Admin dashboard API — the read side of our first-party analytics.
 *
 * Authenticates with the Supabase JWT of the signed-in admin, not the viewer
 * session token `apiFetch` reaches for by default. The backend checks that
 * token's email against its ADMIN_EMAILS allowlist on every request, so nothing
 * here is trusted to gate itself.
 */

export interface EventTotals {
  events: number;
  errors: number;
  sessions: number;
  storytellers: number;
  /** Stories that actually reached a family — the number that matters. */
  storiesCompleted: number;
  recordingsStarted: number;
  /** Distinct people, not incidents: twelve retries by one phone is one person. */
  peopleAffectedByProblems: number;
}

export interface FunnelStep {
  name: string;
  position: number;
  sessions: number;
  /** Same step over the immediately preceding window of equal length. */
  previous_sessions: number;
}

export interface EventNameCount {
  name: string;
  kind: 'action' | 'error';
  count: number;
  storytellers: number;
  last_at: string;
}

export interface ErrorGroup {
  name: string;
  message: string;
  count: number;
  storytellers: number;
  last_at: string;
}

/** An upload that died, described by the app's own stage/reason enums. */
export interface UploadFailure {
  reason: string;
  stage: string;
  count: number;
  storytellers: number;
}

export interface Timings {
  uploadMedianMs: number | null;
  uploadP90Ms: number | null;
  uploadSamples: number;
  storyMedianSeconds: number | null;
  storySamples: number;
  medianBytes: number | null;
}

export interface VersionSplit {
  platform: string;
  app_version: string;
  sessions: number;
  errors: number;
}

export interface SeriesPoint {
  bucket: string;
  count: number;
  errors: number;
  completed: number;
}

export interface EventSummary {
  since: string;
  windowHours: number;
  bucket: string;
  totals: EventTotals;
  /** The matched preceding window, so every headline can show a direction. */
  previous: EventTotals;
  funnel: FunnelStep[];
  byName: EventNameCount[];
  topErrors: ErrorGroup[];
  uploadFailures: UploadFailure[];
  timings: Timings;
  versions: VersionSplit[];
  series: SeriesPoint[];
}

export interface AppEvent {
  id: number;
  client_event_id: string;
  occurred_at: string;
  received_at: string;
  kind: 'action' | 'error';
  name: string;
  level: 'info' | 'warning' | 'error';
  storyteller_id: string | null;
  session_id: string | null;
  platform: string;
  app_version: string | null;
  props: Record<string, unknown>;
  message: string | null;
  stack: string | null;
}

export interface EventPage {
  events: AppEvent[];
  nextCursor: number | null;
}

export interface EventFilters {
  windowHours: number;
  kind?: 'action' | 'error';
  name?: string;
  level?: 'info' | 'warning' | 'error';
  storytellerId?: string;
  sessionId?: string;
  platform?: string;
  before?: number;
  limit?: number;
}

async function adminFetch<T>(path: string): Promise<T> {
  const token = await getAdminToken();
  if (!token) {
    throw new Error('Not signed in');
  }
  return apiFetch<T>(path, { headers: { Authorization: `Bearer ${token}` } });
}

/** Confirms the signed-in account is on the allowlist before rendering anything. */
export function fetchAdminMe(): Promise<{ id: string; email: string; isAdmin: true }> {
  return adminFetch('/admin/me');
}

export function fetchEventSummary(windowHours: number): Promise<EventSummary> {
  return adminFetch(`/admin/events/summary?windowHours=${windowHours}`);
}

export function fetchEvents(filters: EventFilters): Promise<EventPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return adminFetch(`/admin/events?${params.toString()}`);
}
