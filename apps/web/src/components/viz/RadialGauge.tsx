type Props = {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  size?: number;
  color?: string;
};

/** A ring gauge for a single ratio such as mean score or completion rate. */
export function RadialGauge({
  value,
  max,
  label,
  sublabel,
  size = 132,
  color = 'var(--color-vermillion)',
}: Props) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s var(--ease-out-quint)' }}
        />
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          className="fill-[var(--color-ink)]"
          style={{ fontFamily: 'var(--font-mono)', fontSize: size * 0.22 }}
        >
          {value % 1 === 0 ? value : value.toFixed(1)}
        </text>
        <text
          x="50%"
          y="62%"
          textAnchor="middle"
          className="fill-[var(--color-ink-faint)]"
          style={{ fontFamily: 'var(--font-mono)', fontSize: size * 0.1 }}
        >
          / {max}
        </text>
      </svg>
      <p className="mt-1 text-sm text-ink-soft">{label}</p>
      {sublabel ? <p className="text-[0.75rem] text-ink-muted">{sublabel}</p> : null}
    </div>
  );
}
