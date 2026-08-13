import { useEffect, useState } from 'react';
import { fetchEventSummary, type EventSummary } from '../../api/admin';
import { ActivityChart } from './ActivityChart';
import { bytes, delta, formatDelta, iso, ms, num, pct, secs, ts } from './format';

/**
 * Metrics view over `app_event_summary()`.
 *
 * Raw event names, exact counts, no interpretation. Every figure on this page
 * comes from a single RPC — the aggregation runs in Postgres, so the page stays
 * one request regardless of how much is in the window.
 */

interface OverviewProps {
  windowHours: number;
  /** Bumped by the parent's Refresh button to force a re-read. */
  refreshKey: number;
  onSelectEvent: (name: string) => void;
}

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
  // is an extra render pass, and it drifts the moment a request is superseded.
  const loading = result?.key !== requestKey;
  const summary = result?.summary;

  if (result?.error) return <p className="viewer-error">{result.error}</p>;
  if (!summary) return <p className="admin-muted">Loading…</p>;

  const t = summary.totals;
  const p = summary.previous;

  return (
    <div className={loading ? 'admin-stack admin-stale' : 'admin-stack'}>
      <section className="admin-panel">
        <PanelHead
          title="totals"
          note={`since ${ts(summary.since)} · window ${summary.windowHours}h · bucket ${summary.bucket} · previous window of equal length for deltas`}
        />
        <table className="admin-table admin-table-dense">
          <thead>
            <tr>
              <th>metric</th>
              <th className="admin-num">value</th>
              <th className="admin-num">previous</th>
              <th className="admin-num">delta</th>
            </tr>
          </thead>
          <tbody>
            <MetricRow label="events" value={t.events} previous={p.events} />
            <MetricRow label="errors" value={t.errors} previous={p.errors} invert />
            <tr>
              <td className="admin-mono">error_rate</td>
              <td className="admin-num">{pct(t.errors, t.events, 2)}</td>
              <td className="admin-num admin-dim">{pct(p.errors, p.events, 2)}</td>
              <td className="admin-num admin-dim">—</td>
            </tr>
            <MetricRow label="sessions" value={t.sessions} previous={p.sessions} />
            <MetricRow label="storytellers" value={t.storytellers} previous={p.storytellers} />
            <MetricRow
              label="recordings_started"
              value={t.recordingsStarted}
              previous={p.recordingsStarted}
            />
            <MetricRow
              label="stories_completed"
              value={t.storiesCompleted}
              previous={p.storiesCompleted}
            />
            <MetricRow
              label="storytellers_with_errors"
              value={t.peopleAffectedByProblems}
              previous={p.peopleAffectedByProblems}
              invert
            />
          </tbody>
        </table>
      </section>

      <section className="admin-panel">
        <PanelHead
          title="funnel"
          note="distinct session_id reaching each step · step = conversion from the preceding step · cum = conversion from step 1"
        />
        <table className="admin-table admin-table-dense">
          <thead>
            <tr>
              <th className="admin-num">#</th>
              <th>event</th>
              <th className="admin-num">sessions</th>
              <th className="admin-num">prev</th>
              <th className="admin-num">delta</th>
              <th className="admin-num">step</th>
              <th className="admin-num">cum</th>
            </tr>
          </thead>
          <tbody>
            {summary.funnel.map((step, i) => {
              const top = summary.funnel[0]?.sessions ?? 0;
              const before = i === 0 ? step.sessions : summary.funnel[i - 1].sessions;
              const d = delta(step.sessions, step.previous_sessions);
              return (
                <tr key={step.name}>
                  <td className="admin-num admin-dim">{step.position}</td>
                  <td>
                    <button className="admin-linkish admin-mono" onClick={() => onSelectEvent(step.name)}>
                      {step.name}
                    </button>
                  </td>
                  <td className="admin-num">{num(step.sessions)}</td>
                  <td className="admin-num admin-dim">{num(step.previous_sessions)}</td>
                  <td className={`admin-num ${deltaClass(d.dir, false)}`}>{formatDelta(d)}</td>
                  <td className="admin-num">{i === 0 ? '—' : pct(step.sessions, before)}</td>
                  <td className="admin-num admin-dim">{pct(step.sessions, top)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="admin-panel">
        <PanelHead title="upload_failed" note="grouped by props.stage and props.reason" />
        {summary.uploadFailures.length === 0 ? (
          <p className="admin-muted">No rows.</p>
        ) : (
          <table className="admin-table admin-table-dense">
            <thead>
              <tr>
                <th>stage</th>
                <th>reason</th>
                <th className="admin-num">count</th>
                <th className="admin-num">storytellers</th>
              </tr>
            </thead>
            <tbody>
              {summary.uploadFailures.map((f) => (
                <tr key={`${f.stage}:${f.reason}`}>
                  <td className="admin-mono">{f.stage}</td>
                  <td className="admin-mono">{f.reason}</td>
                  <td className="admin-num">{num(f.count)}</td>
                  <td className="admin-num">{num(f.storytellers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-panel">
        <PanelHead title="errors" note="kind='error', grouped by name + message · top 20" />
        {summary.topErrors.length === 0 ? (
          <p className="admin-muted">No rows.</p>
        ) : (
          <table className="admin-table admin-table-dense">
            <thead>
              <tr>
                <th>name</th>
                <th>message</th>
                <th className="admin-num">count</th>
                <th className="admin-num">storytellers</th>
                <th>last_at</th>
              </tr>
            </thead>
            <tbody>
              {summary.topErrors.map((e) => (
                <tr key={`${e.name}:${e.message}`}>
                  <td>
                    <button className="admin-linkish admin-mono" onClick={() => onSelectEvent(e.name)}>
                      {e.name}
                    </button>
                  </td>
                  <td className="admin-mono admin-wrap">{e.message}</td>
                  <td className="admin-num admin-num-bad">{num(e.count)}</td>
                  <td className="admin-num">{num(e.storytellers)}</td>
                  <td className="admin-nowrap admin-mono" title={iso(e.last_at)}>
                    {ts(e.last_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-panel">
        <PanelHead
          title="timings"
          note="percentile_cont over props on upload_succeeded and story_submitted · medians, not means"
        />
        <table className="admin-table admin-table-dense">
          <thead>
            <tr>
              <th>metric</th>
              <th className="admin-num">value</th>
              <th className="admin-num">n</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="admin-mono">upload_duration_p50</td>
              <td className="admin-num">{ms(summary.timings.uploadMedianMs)}</td>
              <td className="admin-num admin-dim">{num(summary.timings.uploadSamples)}</td>
            </tr>
            <tr>
              <td className="admin-mono">upload_duration_p90</td>
              <td className="admin-num">{ms(summary.timings.uploadP90Ms)}</td>
              <td className="admin-num admin-dim">{num(summary.timings.uploadSamples)}</td>
            </tr>
            <tr>
              <td className="admin-mono">upload_bytes_p50</td>
              <td className="admin-num">{bytes(summary.timings.medianBytes)}</td>
              <td className="admin-num admin-dim">{num(summary.timings.uploadSamples)}</td>
            </tr>
            <tr>
              <td className="admin-mono">story_duration_p50</td>
              <td className="admin-num">{secs(summary.timings.storyMedianSeconds)}</td>
              <td className="admin-num admin-dim">{num(summary.timings.storySamples)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {summary.versions.length > 0 ? (
        <section className="admin-panel">
          <PanelHead title="versions" note="platform × app_version" />
          <table className="admin-table admin-table-dense">
            <thead>
              <tr>
                <th>platform</th>
                <th>app_version</th>
                <th className="admin-num">sessions</th>
                <th className="admin-num">errors</th>
                <th className="admin-num">errors/session</th>
              </tr>
            </thead>
            <tbody>
              {summary.versions.map((v) => (
                <tr key={`${v.platform}:${v.app_version}`}>
                  <td className="admin-mono">{v.platform}</td>
                  <td className="admin-mono">{v.app_version ?? '—'}</td>
                  <td className="admin-num">{num(v.sessions)}</td>
                  <td className={v.errors > 0 ? 'admin-num admin-num-bad' : 'admin-num'}>
                    {num(v.errors)}
                  </td>
                  <td className="admin-num admin-dim">
                    {v.sessions ? (v.errors / v.sessions).toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="admin-panel">
        <PanelHead title="series" note={`one bucket per ${summary.bucket}`} />
        <ActivityChart summary={summary} />
      </section>

      <section className="admin-panel">
        <PanelHead title="events by name" note={`${summary.byName.length} distinct name/kind pairs · top 40`} />
        <table className="admin-table admin-table-dense">
          <thead>
            <tr>
              <th>name</th>
              <th>kind</th>
              <th className="admin-num">count</th>
              <th className="admin-num">storytellers</th>
              <th className="admin-num">% of events</th>
              <th>last_at</th>
            </tr>
          </thead>
          <tbody>
            {summary.byName.map((row) => (
              <tr key={`${row.name}:${row.kind}`}>
                <td>
                  <button className="admin-linkish admin-mono" onClick={() => onSelectEvent(row.name)}>
                    {row.name}
                  </button>
                </td>
                <td className={row.kind === 'error' ? 'admin-mono admin-num-bad' : 'admin-mono admin-dim'}>
                  {row.kind}
                </td>
                <td className="admin-num">{num(row.count)}</td>
                <td className="admin-num">{num(row.storytellers)}</td>
                <td className="admin-num admin-dim">{pct(row.count, t.events)}</td>
                <td className="admin-nowrap admin-mono" title={iso(row.last_at)}>
                  {ts(row.last_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* The unaggregated RPC payload. Cheap to include and it removes the
          question of whether a number on this page was mangled on the way here. */}
      <section className="admin-panel">
        <details>
          <summary className="admin-details-summary admin-mono">
            raw app_event_summary() response
          </summary>
          <pre className="admin-raw">{JSON.stringify(summary, null, 2)}</pre>
        </details>
      </section>
    </div>
  );
}

function PanelHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="admin-panel-head">
      <h2 className="admin-mono">{title}</h2>
      {note ? <p className="admin-panel-note admin-dim">{note}</p> : null}
    </div>
  );
}

/** `invert` marks a metric where up is bad, so errors don't render as growth. */
function MetricRow({
  label,
  value,
  previous,
  invert = false,
}: {
  label: string;
  value: number;
  previous: number;
  invert?: boolean;
}) {
  const d = delta(value, previous);
  return (
    <tr>
      <td className="admin-mono">{label}</td>
      <td className="admin-num">{num(value)}</td>
      <td className="admin-num admin-dim">{num(previous)}</td>
      <td className={`admin-num ${deltaClass(d.dir, invert)}`}>{formatDelta(d)}</td>
    </tr>
  );
}

function deltaClass(dir: Delta['dir'], invert: boolean): string {
  if (dir === 'flat') return 'admin-dim';
  const good = invert ? dir === 'down' : dir === 'up';
  return good ? 'admin-delta-up' : 'admin-delta-down';
}

type Delta = ReturnType<typeof delta>;
