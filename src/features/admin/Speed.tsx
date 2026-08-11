import type { EventSummary } from '../../api/admin';
import { bytes, duration, durationFromSeconds, plural } from './catalogue';

/**
 * How long things take, in units a person can picture.
 *
 * Median and 90th percentile rather than an average: one 4GB story uploaded on
 * hotel wifi drags a mean anywhere it likes, and "the typical upload" is the
 * question actually being asked. The 90th percentile answers the other one —
 * how bad is it for the unluckiest tenth.
 */

export function Speed({ summary }: { summary: EventSummary }) {
  const t = summary.timings;

  if (t.uploadSamples === 0 && t.storySamples === 0) {
    return (
      <p className="admin-muted" style={{ margin: 0 }}>
        No completed stories in this period yet, so there is nothing to time.
      </p>
    );
  }

  return (
    <>
      <div className="admin-facts">
        <Fact
          label="Typical upload"
          value={duration(t.uploadMedianMs)}
          note={
            t.uploadSamples > 0
              ? `Half finish faster than this (${plural(t.uploadSamples, 'upload', 'uploads')})`
              : 'No successful uploads yet'
          }
        />
        <Fact
          label="Slowest uploads"
          value={duration(t.uploadP90Ms)}
          note="The unluckiest 1 in 10 wait at least this long"
        />
        <Fact
          label="Typical story length"
          value={durationFromSeconds(t.storyMedianSeconds)}
          note={
            t.storySamples > 0
              ? `Across ${plural(t.storySamples, 'story', 'stories')} sent`
              : 'No stories sent yet'
          }
        />
        <Fact
          label="Typical story size"
          value={bytes(t.medianBytes)}
          note="How much they send us per story"
        />
      </div>

      {t.uploadP90Ms != null && t.uploadP90Ms > 15 * 60 * 1000 ? (
        <p className="admin-callout">
          Some uploads are taking over 15 minutes. On a phone that is long enough for the person
          to lock the screen or switch apps, which is the most common way an upload dies.
        </p>
      ) : null}
    </>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="admin-fact">
      <span className="admin-tile-label">{label}</span>
      <span className="admin-fact-value">{value}</span>
      <span className="admin-tile-hint">{note}</span>
    </div>
  );
}
