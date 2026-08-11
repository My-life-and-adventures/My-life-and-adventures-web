import { useEffect, useState } from 'react';
import { fetchEventSummary, type EventSummary } from '../../api/admin';
import { ActivityChart } from './ActivityChart';
import { eventCopy, people, windowLabel } from './catalogue';
import { formatTime } from './format';
import { Headline } from './Headline';
import { Journey } from './Journey';
import { Problems } from './Problems';
import { Speed } from './Speed';

/**
 * The analytics tab, arranged as the questions someone actually arrives with:
 * how are we doing, where are people getting stuck, what is broken, how fast is
 * it, and — last, folded away — the raw counts for whoever wants them.
 *
 * Every number on this page comes from one `app_event_summary()` call. The
 * aggregation runs in Postgres, so the page stays a single request no matter how
 * busy the window is.
 */

interface OverviewProps {
  windowHours: number;
  /** Bumped by the parent's Refresh button to force a re-read. */
  refreshKey: number;
  onSelectEvent: (name: string) => void;
}

/** What was fetched, and for which request — see `loading` below. */
interface Result {
  key: string;
  summary?: EventSummary;
  error?: string;
}

export function Overview({ windowHours, refreshKey, onSelectEvent }: OverviewProps) {
  const [result, setResult] = useState<Result | null>(null);
  const requestKey = `${windowHours}:${refreshKey}`;

  useEffect(() => {
    let cancelled = false;
    fetchEventSummary(windowHours)
      .then((summary) => {
        if (!cancelled) setResult({ key: requestKey, summary });
      })
      .catch((e: Error) => {
        if (!cancelled) setResult({ key: requestKey, error: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [windowHours, requestKey]);

  // Derived rather than a separate flag: a `setLoading(true)` in the effect body
  // is an extra render pass, and it drifts out of sync the moment a request is
  // superseded before it lands.
  const loading = result?.key !== requestKey;
  const summary = result?.summary;

  if (result?.error) return <p className="viewer-error">{result.error}</p>;
  if (!summary) return <p className="admin-muted">Loading…</p>;

  return (
    <div className={loading ? 'admin-stack admin-stale' : 'admin-stack'}>
      <Headline summary={summary} />

      <section className="admin-panel">
        <h2>Where people are getting stuck</h2>
        <p className="admin-muted admin-panel-note">
          Every recording passes through these six steps. The bar shows how many people were
          still with you at each one.
        </p>
        <Journey summary={summary} onInspect={onSelectEvent} />
      </section>

      <section className="admin-panel">
        <h2>What&apos;s going wrong</h2>
        <Problems summary={summary} onInspect={onSelectEvent} />
      </section>

      <section className="admin-panel">
        <h2>How long it takes</h2>
        <Speed summary={summary} />
      </section>

      <section className="admin-panel">
        <h2>Activity over the last {windowLabel(summary.windowHours)}</h2>
        <p className="admin-muted admin-panel-note">
          One bar per {summary.bucket}. Hover a bar for exact figures.
        </p>
        <ActivityChart summary={summary} />
      </section>

      {summary.versions.length > 0 ? (
        <section className="admin-panel">
          <h2>Which app versions people are on</h2>
          <p className="admin-muted admin-panel-note">
            Useful after a release: if the newest version has far more errors per person than the
            one before it, something shipped broken.
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Version</th>
                <th className="admin-num">Sessions</th>
                <th className="admin-num">Errors</th>
              </tr>
            </thead>
            <tbody>
              {summary.versions.map((v) => (
                <tr key={`${v.platform}:${v.app_version}`}>
                  <td>
                    {v.platform === 'ios' ? 'iPhone' : v.platform === 'android' ? 'Android' : v.platform}{' '}
                    <span className="admin-mono">{v.app_version}</span>
                  </td>
                  <td className="admin-num">{v.sessions}</td>
                  <td className={v.errors > 0 ? 'admin-num admin-num-bad' : 'admin-num'}>
                    {v.errors}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {/* Raw counts, folded away. Everything above answers a question; this
          answers "what else is in there", which is a different mood. */}
      <section className="admin-panel">
        <details>
          <summary className="admin-details-summary">
            Every event recorded ({summary.byName.length})
          </summary>
          <table className="admin-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>What it is</th>
                <th className="admin-num">Times</th>
                <th className="admin-num">People</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {summary.byName.map((row) => {
                const copy = eventCopy(row.name);
                return (
                  <tr key={`${row.name}:${row.kind}`}>
                    <td>
                      <button className="admin-linkish" onClick={() => onSelectEvent(row.name)}>
                        {copy.label}
                      </button>
                      {copy.meaning ? (
                        <div className="admin-tile-hint">{copy.meaning}</div>
                      ) : null}
                      <div className="admin-mono admin-tile-hint">{row.name}</div>
                    </td>
                    <td className="admin-num">{row.count}</td>
                    <td className="admin-num">{row.storytellers}</td>
                    <td className="admin-nowrap">{formatTime(row.last_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      </section>

      <p className="admin-footnote">
        Covering {people(summary.totals.storytellers)} and {summary.totals.sessions} app{' '}
        {summary.totals.sessions === 1 ? 'session' : 'sessions'} since{' '}
        {formatTime(summary.since)}. Counts of people exclude anyone who wasn&apos;t signed in.
      </p>
    </div>
  );
}
