import type { EventSummary, FunnelStep } from '../../api/admin';
import { eventCopy, people } from './catalogue';

/**
 * The recording journey, as a story rather than a chart.
 *
 * Every step is labelled in plain English, sized against the first step, and —
 * the part that makes this actionable — the single worst drop-off is called out
 * in a sentence above the bars. A funnel that makes you eyeball six numbers to
 * find the problem has made you do its job.
 */

interface JourneyProps {
  summary: EventSummary;
  onInspect: (eventName: string) => void;
}

export function Journey({ summary, onInspect }: JourneyProps) {
  const steps = summary.funnel;
  const start = steps[0]?.sessions ?? 0;

  if (start === 0) {
    return (
      <p className="admin-muted" style={{ margin: 0 }}>
        Nobody has started a recording in this period, so there is no journey to show yet.
      </p>
    );
  }

  const worst = worstDropOff(steps);

  return (
    <>
      {worst ? (
        <p className="admin-callout">
          <strong>Biggest drop-off:</strong> {people(worst.lost)} got as far as{' '}
          <em>{eventCopy(worst.from.name).label}</em> but never reached{' '}
          <em>{eventCopy(worst.to.name).label}</em> — that is{' '}
          {Math.round((worst.lost / worst.from.sessions) * 100)}% of everyone who got that far.
        </p>
      ) : (
        <p className="admin-callout admin-callout-good">
          <strong>No drop-off.</strong> Everyone who started a recording made it all the way
          through.
        </p>
      )}

      <ol className="admin-journey">
        {steps.map((step, i) => {
          const previousStep = i === 0 ? step : steps[i - 1];
          const lost = previousStep.sessions - step.sessions;
          const share = start > 0 ? (step.sessions / start) * 100 : 0;
          const isWorst = worst?.to.name === step.name;

          return (
            <li key={step.name} className={isWorst ? 'admin-journey-worst' : undefined}>
              <div className="admin-journey-head">
                <button
                  className="admin-linkish"
                  onClick={() => onInspect(step.name)}
                  title="Show these events in the activity log"
                >
                  {eventCopy(step.name).label}
                </button>
                <span className="admin-journey-count">
                  <strong>{step.sessions}</strong>
                  <Trend now={step.sessions} before={step.previous_sessions} />
                </span>
              </div>

              <div className="admin-bar" aria-hidden="true">
                <div className="admin-bar-fill" style={{ width: `${share}%` }} />
              </div>

              <p className="admin-journey-note">
                {i === 0
                  ? `${Math.round(share)}% — everyone starts here`
                  : lost > 0
                    ? `${Math.round(share)}% of the people who started · lost ${lost} at this step`
                    : `${Math.round(share)}% of the people who started · nobody lost here`}
              </p>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/**
 * The step that loses the most people in absolute terms.
 *
 * Absolute rather than proportional on purpose: a step that loses 60% of the
 * three people who reached it is noise next to one losing 40 of 200, and the
 * person reading this wants to know where to spend the week.
 *
 * Ties go to the *later* step (`>=`), because the further along someone was, the
 * more they lost by dropping out. Abandoning before recording costs them nothing;
 * losing a finished story to a failed upload costs them the story.
 */
function worstDropOff(
  steps: FunnelStep[],
): { from: FunnelStep; to: FunnelStep; lost: number } | null {
  let worst: { from: FunnelStep; to: FunnelStep; lost: number } | null = null;

  for (let i = 1; i < steps.length; i += 1) {
    const lost = steps[i - 1].sessions - steps[i].sessions;
    if (lost > 0 && (!worst || lost >= worst.lost)) {
      worst = { from: steps[i - 1], to: steps[i], lost };
    }
  }
  return worst;
}

function Trend({ now, before }: { now: number; before: number }) {
  const delta = now - before;
  if (delta === 0) return <span className="admin-delta admin-delta-flat">–</span>;
  return (
    <span className={`admin-delta admin-delta-${delta > 0 ? 'good' : 'bad'}`}>
      {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}
    </span>
  );
}
