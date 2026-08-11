import type { EventSummary } from '../../api/admin';
import { describeUploadFailure, eventLabel, people, times } from './catalogue';
import { formatTime } from './format';

/**
 * What is going wrong, ordered by how many people it hurt.
 *
 * Deliberately not ordered by event count: one phone retrying a dead upload
 * twelve times writes twelve rows but represents one frustrated person, and
 * ranking by rows would put that above a bug quietly affecting a dozen users.
 */

interface ProblemsProps {
  summary: EventSummary;
  onInspect: (eventName: string) => void;
}

export function Problems({ summary, onInspect }: ProblemsProps) {
  const { uploadFailures, topErrors } = summary;
  const nothingWrong = uploadFailures.length === 0 && topErrors.length === 0;

  if (nothingWrong) {
    return (
      <p className="admin-callout admin-callout-good" style={{ marginBottom: 0 }}>
        <strong>Nothing broke.</strong> No failed uploads and no errors were reported in this
        period.
      </p>
    );
  }

  return (
    <>
      {uploadFailures.length > 0 ? (
        <>
          <h3 className="admin-subhead">Stories that didn&apos;t make it</h3>
          <p className="admin-muted admin-panel-note">
            Someone recorded a story and it failed to reach us. These are the ones worth fixing
            first — the recording already existed.
          </p>
          <ul className="admin-problems">
            {uploadFailures.map((f) => (
              <li key={`${f.reason}:${f.stage}`}>
                <div className="admin-problem-main">
                  {describeUploadFailure(f.reason, f.stage)}
                </div>
                <div className="admin-problem-meta">
                  Affected {people(f.storytellers)} · happened {times(f.count)}
                  {f.count > f.storytellers ? ' (some retried)' : ''}
                </div>
              </li>
            ))}
          </ul>
          <button className="admin-linkish" onClick={() => onInspect('upload_failed')}>
            See these in the activity log
          </button>
        </>
      ) : null}

      {topErrors.length > 0 ? (
        <>
          <h3 className="admin-subhead" style={{ marginTop: uploadFailures.length ? 28 : 0 }}>
            Errors the app reported
          </h3>
          <p className="admin-muted admin-panel-note">
            Technical faults caught by the app. The message is what the phone reported, so it is
            worth passing to a developer as-is.
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>What happened</th>
                <th>Technical message</th>
                <th className="admin-num">People</th>
                <th className="admin-num">Times</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {topErrors.map((e) => (
                <tr key={`${e.name}:${e.message}`}>
                  <td>
                    <button className="admin-linkish" onClick={() => onInspect(e.name)}>
                      {eventLabel(e.name)}
                    </button>
                  </td>
                  <td className="admin-wrap admin-mono">{e.message}</td>
                  <td className="admin-num">{e.storytellers}</td>
                  <td className="admin-num">{e.count}</td>
                  <td className="admin-nowrap">{formatTime(e.last_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </>
  );
}
