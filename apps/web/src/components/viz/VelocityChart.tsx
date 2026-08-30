import type { VelocityPoint } from '@kanzen/shared';

type Props = { points: VelocityPoint[]; height?: number };

/** Monthly completions as bars with the trailing mean drawn as an aurora line. */
export function VelocityChart({ points, height = 180 }: Props) {
  const data = points.slice(-18);
  if (data.length < 2) {
    return <p className="text-sm text-ink-muted">Complete a few titles to chart your pace.</p>;
  }
  const width = 640;
  const pad = { l: 28, r: 12, t: 12, b: 24 };
  const max = Math.max(...data.map((d) => Math.max(d.completed, d.movingAverage)), 1);
  const bw = (width - pad.l - pad.r) / data.length;

  const x = (i: number) => pad.l + i * bw + bw / 2;
  const y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);

  const line = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(d.movingAverage).toFixed(1)}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Completion velocity"
    >
      {[0, 0.5, 1].map((t) => (
        <line
          key={t}
          x1={pad.l}
          x2={width - pad.r}
          y1={pad.t + t * (height - pad.t - pad.b)}
          y2={pad.t + t * (height - pad.t - pad.b)}
          stroke="var(--color-hairline)"
          strokeWidth="1"
        />
      ))}
      {data.map((d, i) => {
        const h = (d.completed / max) * (height - pad.t - pad.b);
        return (
          <rect
            key={d.month}
            x={x(i) - bw * 0.3}
            y={height - pad.b - h}
            width={bw * 0.6}
            height={Math.max(h, 1)}
            rx="2"
            fill="var(--color-surface-2)"
            stroke="var(--color-hairline-bright)"
            strokeWidth="0.75"
          />
        );
      })}
      <path
        d={line}
        fill="none"
        stroke="var(--color-aurora-teal)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {data.map((d, i) => (
        <circle
          key={d.month}
          cx={x(i)}
          cy={y(d.movingAverage)}
          r="2.4"
          fill="var(--color-aurora-violet)"
        />
      ))}
      {data.map((d, i) =>
        i % Math.ceil(data.length / 6) === 0 ? (
          <text
            key={d.month}
            x={x(i)}
            y={height - 6}
            textAnchor="middle"
            className="fill-[var(--color-ink-faint)] text-[9px]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {d.month.slice(2)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
