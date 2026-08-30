import { useMemo } from 'react';
import type { TasteAxis } from '@kanzen/shared';

type Props = { axes: TasteAxis[]; size?: number };

/** Taste fingerprint radar. Values are already normalised 0 to 1. */
export function RadarChart({ axes, size = 300 }: Props) {
  const data = axes.slice(0, 8);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 62;

  const points = useMemo(() => {
    return data.map((axis, i) => {
      const angle = (Math.PI * 2 * i) / data.length - Math.PI / 2;
      const value = Math.max(0.06, axis.value);
      return {
        ...axis,
        angle,
        x: cx + Math.cos(angle) * r * value,
        y: cy + Math.sin(angle) * r * value,
        lx: cx + Math.cos(angle) * (r + 26),
        ly: cy + Math.sin(angle) * (r + 26),
      };
    });
  }, [data, cx, cy, r]);

  if (data.length < 3) {
    return (
      <p className="text-sm text-ink-muted">Not enough rated entries yet for a fingerprint.</p>
    );
  }

  const path =
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
    ' Z';

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full"
      role="img"
      aria-label="Taste fingerprint"
    >
      <defs>
        <radialGradient id="radar-fill" cx="50%" cy="50%">
          <stop offset="0%" stopColor="var(--color-aurora-teal)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--color-aurora-violet)" stopOpacity="0.12" />
        </radialGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <circle
          key={ring}
          cx={cx}
          cy={cy}
          r={r * ring}
          fill="none"
          stroke="var(--color-hairline)"
          strokeWidth="1"
        />
      ))}
      {points.map((p, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + Math.cos(p.angle) * r}
          y2={cy + Math.sin(p.angle) * r}
          stroke="var(--color-hairline)"
          strokeWidth="1"
        />
      ))}
      <path d={path} fill="url(#radar-fill)" stroke="var(--color-aurora-teal)" strokeWidth="1.6" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="var(--color-vermillion)" />
          <text
            x={p.lx}
            y={p.ly}
            textAnchor={Math.abs(p.lx - cx) < 8 ? 'middle' : p.lx > cx ? 'start' : 'end'}
            dominantBaseline="middle"
            className="fill-[var(--color-ink-soft)] text-[10px]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {p.label.length > 14 ? `${p.label.slice(0, 13)}…` : p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
