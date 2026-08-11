import type { EventSummary } from '../../api/admin';
import { people, windowLabel } from './catalogue';

/**
 * The top of the dashboard: a sentence, then four numbers.
 *
 * The sentence exists because a grid of figures asks the reader to do the
 * interpreting. Someone opening this on a Monday morning should learn how the
 * product is doing before they have parsed a single tile.
 */

interface HeadlineProps {
  summary: EventSummary;
}

export function Headline({ summary }: HeadlineProps) {
  const t = summary.totals;
  const p = summary.previous;
  const period = windowLabel(summary.windowHours);

  return (
    <>
      <p className="admin-lede">{narrate(summary)}</p>

      <div className="admin-tiles">
        <Tile
          label="Stories delivered"
          value={t.storiesCompleted}
          previous={p.storiesCompleted}
          period={period}
          hint="Finished stories a family can now watch."
        />
        <Tile
          label="People recording"
          value={t.storytellers}
          previous={p.storytellers}
          period={period}
          hint="Signed-in people who did something in the app."
        />
        <Tile
          label="Recordings started"
          value={t.recordingsStarted}
          previous={p.recordingsStarted}
          period={period}
          hint="Times someone tapped Record."
        />
        <Tile
          label="People hitting problems"
          value={t.peopleAffectedByProblems}
          previous={p.peopleAffectedByProblems}
          period={period}
          // Fewer is better here, so the arrow's colour has to be inverted or
          // a rise in failures would render as a cheerful green.
          lowerIsBetter
          hint="People who saw a failure, however briefly."
        />
      </div>
    </>
  );
}

/** One or two sentences summarising the window in ordinary language. */
function narrate(summary: EventSummary): string {
  const t = summary.totals;
  const period = windowLabel(summary.windowHours);

  if (t.events === 0) {
    return `Nothing has been recorded in the last ${period}. Once the app is in people's hands, this is where their activity will appear.`;
  }

  const started = t.recordingsStarted;
  const done = t.storiesCompleted;

  let first: string;
  if (started === 0) {
    first = `In the last ${period}, nobody started a recording.`;
  } else {
    first = `In the last ${period}, ${people(t.storytellers)} used the app and started ${started === 1 ? '1 recording' : `${started} recordings`}. ${
      done === 0
        ? 'None of them have turned into a finished story yet.'
        : `${done === 1 ? '1 story' : `${done} stories`} reached a family.`
    }`;
  }

  const hurt = t.peopleAffectedByProblems;
  const second =
    hurt === 0
      ? ' Nobody ran into a problem.'
      : ` ${people(hurt)} ran into a problem along the way — see below.`;

  return first + second;
}

interface TileProps {
  label: string;
  value: number;
  previous: number;
  period: string;
  hint: string;
  lowerIsBetter?: boolean;
}

function Tile({ label, value, previous, period, hint, lowerIsBetter }: TileProps) {
  const delta = value - previous;
  const better = lowerIsBetter ? delta < 0 : delta > 0;
  const tone = delta === 0 ? 'flat' : better ? 'good' : 'bad';

  return (
    <div className="admin-tile">
      <span className="admin-tile-label">{label}</span>
      <span className="admin-tile-value">{value.toLocaleString()}</span>
      <span className={`admin-delta admin-delta-${tone}`}>
        {delta === 0
          ? `Same as the previous ${period}`
          : `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toLocaleString()} vs the previous ${period}`}
      </span>
      <span className="admin-tile-hint">{hint}</span>
    </div>
  );
}
