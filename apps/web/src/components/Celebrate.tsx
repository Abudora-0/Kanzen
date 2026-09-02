import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const COLORS = [
  'var(--color-vermillion-bright)',
  'var(--color-aurora-teal)',
  'var(--color-aurora-violet)',
  'var(--color-gold)',
];

/**
 * A short particle burst fired whenever `trigger` changes to a new truthy value.
 * Render it inside a `position: relative` container next to the control that
 * caused the celebration. Reduced motion renders nothing.
 */
export function Celebrate({ trigger }: { trigger: number }) {
  const reduceMotion = useReducedMotion();
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (trigger > 0) setKey((k) => k + 1);
  }, [trigger]);

  if (reduceMotion || key === 0) return null;

  return (
    <span key={key} className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0" aria-hidden>
      {Array.from({ length: 14 }).map((_, i) => {
        const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.6;
        const dist = 26 + Math.random() * 26;
        return (
          <span
            key={i}
            className="absolute block h-1.5 w-1.5 rounded-full"
            style={{
              background: COLORS[i % COLORS.length],
              ['--sx' as string]: `${Math.cos(angle) * dist}px`,
              ['--sy' as string]: `${Math.sin(angle) * dist}px`,
              animation: `kanzen-spark ${0.5 + Math.random() * 0.35}s var(--ease-out-quint) forwards`,
            }}
          />
        );
      })}
    </span>
  );
}
