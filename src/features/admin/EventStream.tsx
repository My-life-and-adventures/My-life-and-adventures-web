import { useEffect, useState } from 'react';
import { fetchEvents, type AppEvent, type EventFilters } from '../../api/admin';
import { eventCopy } from './catalogue';
import { describeEvent } from './describeEvent';
import { formatTime } from './format';

/**
 * The raw stream: every recorded action and error, newest first.
 *
 * This is the tab you open with a support ticket in the other window — filter to
 * one storyteller or one session and read what actually happened, in order.
 * Paging is keyset ("load older"), because the table is append-only and busy
 * enough that an offset page would shift under you between clicks.
 */

interface EventStreamProps {
  windowHours: number;
  refreshKey: number;
  /**
   * Pre-selected event name when arriving from a click on the overview. The
   * parent remounts this component when it changes (via `key`), so this is a
   * genuine initial value rather than something to sync in an effect.
   */
  initialName?: string;
}

/** A loaded page, tagged with the filter set it belongs to. */
interface Page {
  key: string;
  events: AppEvent[];
  cursor: number | null;
  error?: string;
}

const PAGE_SIZE = 50;

export function EventStream({ windowHours, refreshKey, initialName }: EventStreamProps) {
  const [name, setName] = useState(initialName ?? '');
  const [kind, setKind] = useState<'' | 'action' | 'error'>('');
  const [storytellerId, setStorytellerId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [page, setPage] = useState<Page | null>(null);
  const [appending, setAppending] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Every input that changes what the server returns. Also the identity of the
  // current request, which is how "is this page stale?" is answered without a
  // separate loading flag.
  const requestKey = JSON.stringify([windowHours, name, kind, storytellerId, sessionId, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    const filters = buildFilters(requestKey);

    fetchEvents(filters)
      .then((result) => {
        if (!cancelled) {
          setPage({ key: requestKey, events: result.events, cursor: result.nextCursor });
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setPage({ key: requestKey, events: [], cursor: null, error: e.message });
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const loading = page?.key !== requestKey;

  /** "Load older" — a user action, so it appends to the page in place. */
  async function loadOlder() {
    if (!page?.cursor) return;
    setAppending(true);
    try {
      const older = await fetchEvents({ ...buildFilters(requestKey), before: page.cursor });
      setPage((current) =>
        // Guard against the filters having changed while this was in flight.
        current && current.key === requestKey
          ? { ...current, events: [...current.events, ...older.events], cursor: older.nextCursor }
          : current,
      );
    } catch (e) {
      setPage((current) =>
        current && current.key === requestKey
          ? { ...current, error: (e as Error).message }
          : current,
      );
    } finally {
      setAppending(false);
    }
  }

  return (
    <div className="admin-stack">
      <section className="admin-panel">
        <div className="admin-filters">
          <label>
            Event name
            <input
              type="text"
              value={name}
              placeholder="e.g. upload_failed"
              onChange={(e) => setName(e.target.value.trim())}
            />
          </label>
          <label>
            Show
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="">Everything</option>
              <option value="action">Things people did</option>
              <option value="error">Only problems</option>
            </select>
          </label>
          <label>
            Storyteller id
            <input
              type="text"
              value={storytellerId}
              placeholder="uuid"
              onChange={(e) => setStorytellerId(e.target.value.trim())}
            />
          </label>
          <label>
            Session id
            <input
              type="text"
              value={sessionId}
              placeholder="uuid"
              onChange={(e) => setSessionId(e.target.value.trim())}
            />
          </label>
        </div>
      </section>

      {page?.error ? <p className="viewer-error">{page.error}</p> : null}

      <section className={loading ? 'admin-panel admin-stale' : 'admin-panel'}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>What happened</th>
              <th>Device</th>
              <th>Who</th>
              <th>More</th>
            </tr>
          </thead>
          <tbody>
            {(page?.events ?? []).map((event) => (
              <Row
                key={event.id}
                event={event}
                expanded={expanded === event.id}
                onToggle={() => setExpanded(expanded === event.id ? null : event.id)}
                onPickSession={setSessionId}
              />
            ))}
          </tbody>
        </table>

        {page && !loading && page.events.length === 0 ? (
          <p className="admin-muted">No events match these filters.</p>
        ) : null}
        {!page ? <p className="admin-muted">Loading…</p> : null}

        <div className="admin-actions">
          {page?.cursor && !loading ? (
            <button type="button" disabled={appending} onClick={() => void loadOlder()}>
              {appending ? 'Loading…' : 'Load older'}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/** Rebuilds the filter object from the request key, so the two cannot diverge. */
function buildFilters(requestKey: string): EventFilters {
  const [windowHours, name, kind, storytellerId, sessionId] = JSON.parse(requestKey) as [
    number,
    string,
    string,
    string,
    string,
  ];

  const filters: EventFilters = { windowHours, limit: PAGE_SIZE };
  if (name) filters.name = name;
  if (kind) filters.kind = kind as 'action' | 'error';
  if (storytellerId) filters.storytellerId = storytellerId;
  if (sessionId) filters.sessionId = sessionId;
  return filters;
}

/** One breadcrumb the phone recorded on its way to an error. */
interface TrailEntry {
  at: string;
  tag: string;
  level: string;
  message: string;
}

/**
 * The last few things the app logged before it failed. This is the single most
 * useful thing on the page when diagnosing an upload — it is the trail Sentry
 * breadcrumbs used to carry, now stored on the event itself.
 */
function Trail({ props }: { props: Record<string, unknown> }) {
  const raw = props?.trail;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const entries = raw as TrailEntry[];

  return (
    <details className="admin-trail" open>
      <summary>What the app was doing just before ({entries.length} steps)</summary>
      <ol>
        {entries.map((entry, i) => (
          <li key={`${entry.at}:${i}`} className={entry.level === 'error' ? 'admin-trail-bad' : undefined}>
            <span className="admin-mono">{formatTime(entry.at)}</span> [{entry.tag}] {entry.message}
          </li>
        ))}
      </ol>
    </details>
  );
}

/** The trail gets its own rendering above, so keep it out of the JSON dump. */
function stripTrail(props: Record<string, unknown>): Record<string, unknown> {
  if (!props || !('trail' in props)) return props ?? {};
  const rest = { ...props };
  delete rest.trail;
  return rest;
}

function Row({
  event,
  expanded,
  onToggle,
  onPickSession,
}: {
  event: AppEvent;
  expanded: boolean;
  onToggle: () => void;
  onPickSession: (id: string) => void;
}) {
  const isError = event.kind === 'error';
  // Props always exist; a stack or message only for errors, and all of it is
  // long enough that it belongs behind a click rather than in the row.
  const hasDetail =
    Object.keys(event.props ?? {}).length > 0 || Boolean(event.stack) || Boolean(event.message);
  // The headline sentence for this row. Errors already show their message in
  // the column below, so they don't get one.
  const description = isError ? null : describeEvent(event);

  return (
    <>
      <tr className={isError ? 'admin-row-error' : undefined}>
        <td className="admin-nowrap">{formatTime(event.occurred_at)}</td>
        <td>
          <span className="admin-event-label">{eventCopy(event.name).label}</span>
          {isError ? <span className="admin-badge">error</span> : null}
          {description ? <div className="admin-tile-hint">{description}</div> : null}
          {event.message ? <div className="admin-event-message">{event.message}</div> : null}
        </td>
        <td className="admin-nowrap">
          {event.platform === 'ios' ? 'iPhone' : event.platform === 'android' ? 'Android' : event.platform}
          {event.app_version ? ` ${event.app_version}` : ''}
        </td>
        <td className="admin-nowrap">
          {event.storyteller_id ? (
            <code title={event.storyteller_id}>{event.storyteller_id.slice(0, 8)}</code>
          ) : (
            <span className="admin-muted">signed out</span>
          )}
          {event.session_id ? (
            <button
              className="admin-linkish"
              title="Filter to this session"
              onClick={() => onPickSession(event.session_id!)}
            >
              session
            </button>
          ) : null}
        </td>
        <td>
          {hasDetail ? (
            <button className="admin-linkish" onClick={onToggle}>
              {expanded ? 'Hide' : 'Show'}
            </button>
          ) : (
            <span className="admin-muted">—</span>
          )}
        </td>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={5}>
            <div className="admin-detail">
              <p className="admin-tile-hint" style={{ marginTop: 0 }}>
                {eventCopy(event.name).meaning ?? 'Recorded by the app.'} Internal name:{' '}
                <span className="admin-mono">{event.name}</span>
              </p>
              <Trail props={event.props} />
              <pre>{JSON.stringify(stripTrail(event.props), null, 2)}</pre>
              {event.stack ? (
                <details>
                  <summary>Technical stack trace</summary>
                  <pre>{event.stack}</pre>
                </details>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
