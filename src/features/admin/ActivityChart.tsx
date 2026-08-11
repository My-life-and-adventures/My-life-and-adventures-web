import type { EventSummary } from '../../api/admin';
import { formatTime } from './format';

/**
 * Activity over the window: total events, with completed stories and errors
 * picked out.
 *
 * Hand-rolled SVG rather than a charting library — it is three series of bars
 * and a dependency would outweigh the component. Hovering any bar gives the
 * exact figures, so the chart never has to be read precisely.
 */

const HEIGHT = 40;

export function ActivityChart({ summary }: { summary: EventSummary }) {
  const points = summary.series;

  if (points.length === 0) {
    return <p className="admin-muted">Nothing recorded yet.</p>;
  }

  const peak = Math.max(...points.map((p) => p.count), 1);
  const width = Math.max(points.length, 1) * 10;
  const barWidth = width / points.length;

  const totalCompleted = points.reduce((sum, p) => sum + p.completed, 0);
  const totalErrors = points.reduce((sum, p) => sum + p.errors, 0);

  return (
    <>
      <svg
        className="admin-chart"
        viewBox={`0 0 ${width} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Activity per ${summary.bucket}. Busiest period had ${peak} events.`}
      >
        {points.map((p, i) => {
          const scale = (n: number) => (n / peak) * HEIGHT;
          return (
            <g key={p.bucket}>
              <title>
                {`${formatTime(p.bucket)} — ${p.count} events, ${p.completed} stories delivered, ${p.errors} errors`}
              </title>
              {/* Full-height hit area so the tooltip is reachable on short bars. */}
              <rect x={i * barWidth} y={0} width={barWidth} height={HEIGHT} fill="transparent" />
              <rect
                x={i * barWidth}
                y={HEIGHT - scale(p.count)}
                width={barWidth * 0.72}
                height={scale(p.count)}
                fill="var(--accent-soft-solid, rgba(181,83,42,0.28))"
              />
              {p.completed > 0 ? (
                <rect
                  x={i * barWidth}
                  y={HEIGHT - scale(p.completed)}
                  width={barWidth * 0.72}
                  height={scale(p.completed)}
                  fill="var(--accent)"
                />
              ) : null}
              {p.errors > 0 ? (
                <rect
                  x={i * barWidth + barWidth * 0.72}
                  y={HEIGHT - scale(p.errors)}
                  width={barWidth * 0.28}
                  height={scale(p.errors)}
                  fill="var(--error)"
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      <ul className="admin-legend">
        <li>
          <span className="admin-swatch admin-swatch-faint" /> All activity
        </li>
        <li>
          <span className="admin-swatch admin-swatch-accent" /> Stories delivered (
          {totalCompleted})
        </li>
        <li>
          <span className="admin-swatch admin-swatch-error" /> Errors ({totalErrors})
        </li>
      </ul>
    </>
  );
}
