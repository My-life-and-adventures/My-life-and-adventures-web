import { useEffect, useState } from 'react';
import { fetchEvents, type AppEvent, type EventFilters } from '../../api/admin';
import { iso, ts } from './format';

/**
 * Raw `app_events` rows, newest first.
 *
 * Filter to one storyteller or one session and read the sequence as recorded.
 * Paging is keyset ("load older") because the table is append-only and busy
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
  const [level, setLevel] = useState<'' | 'info' | 'warning' | 'error'>('');
  const [platform, setPlatform] = useState('');
  const [storytellerId, setStorytellerId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [page, setPage] = useState<Page | null>(null);
  const [appending, setAppending] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Every input that changes what the server returns. Also the identity of the
  // current request, which is how "is this page stale?" is answered without a
  // separate loading flag.
  const requestKey = JSON.stringify([
    windowHours,
    name,
    kind,
    level,
    platform,
    storytellerId,
    sessionId,
    refreshKey,
  ]);

  useEffect(() => {
    let cancelled = false;

    fetchEvents(buildFilters(requestKey))
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

  function toggle(id: number) {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  const rows = page?.events ?? [];

  return (
    <div className="admin-stack">
      <section className="admin-panel">
        <div className="admin-filters">
          <label>
            name
            <input
              type="text"
              className="admin-mono"
              value={name}
              placeholder="upload_failed"
              onChange={(e) => setName(e.target.value.trim())}
            />
          </label>
          <label>
            kind
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="">*</option>
              <option value="action">action</option>
              <option value="error">error</option>
            </select>
          </label>
          <label>
            level
            <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
              <option value="">*</option>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
            </select>
          </label>
          <label>
            platform
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="">*</option>
              <option value="ios">ios</option>
              <option value="android">android</option>
              <option value="web">web</option>
              <option value="unknown">unknown</option>
            </select>
          </label>
          <label>
            storyteller_id
            <input
              type="text"
              className="admin-mono"
              value={storytellerId}
              placeholder="uuid"
              onChange={(e) => setStorytellerId(e.target.value.trim())}
            />
          </label>
          <label>
            session_id
            <input
              type="text"
              className="admin-mono"
              value={sessionId}
              placeholder="uuid"
              onChange={(e) => setSessionId(e.target.value.trim())}
            />
          </label>
        </div>
      </section>

      {page?.error ? <p className="viewer-error">{page.error}</p> : null}

      <section className={loading ? 'admin-panel admin-stale' : 'admin-panel'}>
        <div className="admin-panel-head">
          <h2 className="admin-mono">app_events</h2>
          <p className="admin-panel-note admin-dim">
            {rows.length} row{rows.length === 1 ? '' : 's'} · window {windowHours}h · order by id
            desc · limit {PAGE_SIZE}
          </p>
        </div>

        <table className="admin-table admin-table-dense">
          <thead>
            <tr>
              <th className="admin-num">id</th>
              <th>occurred_at</th>
              <th>name</th>
              <th>lvl</th>
              <th>platform</th>
              <th>ver</th>
              <th>storyteller_id</th>
              <th>session_id</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((event) => (
              <Row
                key={event.id}
                event={event}
                expanded={expanded.has(event.id)}
                onToggle={() => toggle(event.id)}
                onPickSession={setSessionId}
                onPickStoryteller={setStorytellerId}
              />
            ))}
          </tbody>
        </table>

        {page && !loading && rows.length === 0 ? (
          <p className="admin-muted">0 rows.</p>
        ) : null}
        {!page ? <p className="admin-muted">Loading…</p> : null}

        <div className="admin-actions">
          {page?.cursor && !loading ? (
            <button type="button" disabled={appending} onClick={() => void loadOlder()}>
              {appending ? 'Loading…' : `Load older (id < ${page.cursor})`}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/** Rebuilds the filter object from the request key, so the two cannot diverge. */
function buildFilters(requestKey: string): EventFilters {
  const [windowHours, name, kind, level, platform, storytellerId, sessionId] = JSON.parse(
    requestKey,
  ) as [number, string, string, string, string, string, string];

  const filters: EventFilters = { windowHours, limit: PAGE_SIZE };
  if (name) filters.name = name;
  if (kind) filters.kind = kind as 'action' | 'error';
  if (level) filters.level = level as 'info' | 'warning' | 'error';
  if (platform) filters.platform = platform;
  if (storytellerId) filters.storytellerId = storytellerId;
  if (sessionId) filters.sessionId = sessionId;
  return filters;
}

function Row({
  event,
  expanded,
  onToggle,
  onPickSession,
  onPickStoryteller,
}: {
  event: AppEvent;
  expanded: boolean;
  onToggle: () => void;
  onPickSession: (id: string) => void;
  onPickStoryteller: (id: string) => void;
}) {
  const isError = event.kind === 'error';

  return (
    <>
      <tr className={isError ? 'admin-row-error' : undefined}>
        <td className="admin-num admin-dim admin-mono">{event.id}</td>
        <td className="admin-nowrap admin-mono" title={`received_at ${iso(event.received_at)}`}>
          {ts(event.occurred_at)}
        </td>
        <td className="admin-mono">
          {event.name}
          {event.message ? (
            <span className="admin-inline-msg" title={event.message}>
              {event.message}
            </span>
          ) : null}
        </td>
        <td className={`admin-mono ${isError ? 'admin-num-bad' : 'admin-dim'}`}>{event.level}</td>
        <td className="admin-mono admin-dim">{event.platform}</td>
        <td className="admin-mono admin-dim">{event.app_version ?? '—'}</td>
        <td className="admin-mono">
          {event.storyteller_id ? (
            <button
              className="admin-linkish admin-mono"
              title={`filter to ${event.storyteller_id}`}
              onClick={() => onPickStoryteller(event.storyteller_id!)}
            >
              {event.storyteller_id.slice(0, 8)}
            </button>
          ) : (
            <span className="admin-dim">null</span>
          )}
        </td>
        <td className="admin-mono">
          {event.session_id ? (
            <button
              className="admin-linkish admin-mono"
              title={`filter to ${event.session_id}`}
              onClick={() => onPickSession(event.session_id!)}
            >
              {event.session_id.slice(0, 8)}
            </button>
          ) : (
            <span className="admin-dim">null</span>
          )}
        </td>
        <td>
          <button className="admin-linkish admin-mono" onClick={onToggle}>
            {expanded ? '−' : '+'}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={9}>
            {/* The whole row as stored, including client_event_id and received_at
                — the two fields that answer "did this arrive late or twice?". */}
            <pre className="admin-raw">{JSON.stringify(event, null, 2)}</pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}
