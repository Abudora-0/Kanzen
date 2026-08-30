import { useMemo } from 'react';
import type { HeatCell } from '@kanzen/shared';

type Props = { cells: HeatCell[] };

/** A calendar of the last 53 weeks. Deeper vermillion means more activity. */
export function Heatmap({ cells }: Props) {
  const { weeks, max } = useMemo(() => {
    const map = new Map(cells.map((c) => [c.date, c.count]));
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 364 - ((start.getDay() + 6) % 7));
    const days: { date: string; count: number }[] = [];
    for (let i = 0; i < 371; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, count: map.get(key) ?? 0 });
    }
    const grouped: { date: string; count: number }[][] = [];
    for (let w = 0; w < 53; w += 1) grouped.push(days.slice(w * 7, w * 7 + 7));
    return { weeks: grouped, max: Math.max(1, ...days.map((d) => d.count)) };
  }, [cells]);

  const shade = (count: number) => {
    if (count === 0) return 'var(--color-surface)';
    const t = Math.min(1, 0.25 + (count / max) * 0.75);
    return `color-mix(in oklab, var(--color-vermillion) ${Math.round(t * 100)}%, var(--color-surface))`;
  };

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${53 * 14} ${7 * 14 + 4}`}
        className="min-w-[560px]"
        role="img"
        aria-label="Activity heatmap"
      >
        {weeks.map((week, wi) =>
          week.map((day, di) => (
            <rect
              key={day.date}
              x={wi * 14}
              y={di * 14}
              width="11"
              height="11"
              rx="2.5"
              fill={shade(day.count)}
              stroke="var(--color-hairline)"
              strokeWidth="0.5"
            >
              <title>{`${day.date}: ${day.count} update${day.count === 1 ? '' : 's'}`}</title>
            </rect>
          )),
        )}
      </svg>
    </div>
  );
}
