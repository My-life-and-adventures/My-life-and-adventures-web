import type { EventSummary } from '../../api/admin';
import { num, ts } from './format';

/**
 * Event counts per bucket, with errors and completions overlaid.
 *
 * Hand-rolled SVG rather than a charting library — three series of bars, and a
 * dependency would outweigh the component. Hover any bar for exact figures; the
 * peak is labelled so the y-scale is never guesswork.
 */

const HEIGHT = 40;

export function ActivityChart({ summary }: { summary: EventSummary }) {
  const points = summary.series;

  if (points.length === 0) {
    return <p className="admin-muted">0 buckets.</p>;
  }

  const peak = Math.max(...points.map((p) => p.count), 1);
  const width = Math.max(points.length, 1) * 10;
  const barWidth = width / points.length;

  const totals = points.reduce(
    (acc, p) => ({
      count: acc.count + p.count,
      completed: acc.completed + p.completed,
      errors: acc.errors + p.errors,
    }),
    { count: 0, completed: 0, errors: 0 },
  );

  return (
    <>
      <div className="admin-chart-frame">
        <span className="admin-chart-peak admin-mono admin-dim">{num(peak)}</span>
        <svg
          className="admin-chart"
          viewBox={`0 0 ${width} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`count per ${summary.bucket}, peak ${peak}`}
        >
          {points.map((p, i) => {
            const scale = (n: number) => (n / peak) * HEIGHT;
            return (
              <g key={p.bucket}>
                <title>
                  {`${ts(p.bucket)}\ncount=${p.count} completed=${p.completed} errors=${p.errors}`}
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
      </div>

      <div className="admin-chart-axis admin-mono admin-dim">
        <span>{ts(points[0].bucket)}</span>
        <span>{ts(points[points.length - 1].bucket)}</span>
      </div>

      <ul className="admin-legend admin-mono">
        <li>
          <span className="admin-swatch admin-swatch-faint" /> count ({num(totals.count)})
        </li>
        <li>
          <span className="admin-swatch admin-swatch-accent" /> processing_succeeded (
          {num(totals.completed)})
        </li>
        <li>
          <span className="admin-swatch admin-swatch-error" /> errors ({num(totals.errors)})
        </li>
      </ul>
    </>
  );
}
