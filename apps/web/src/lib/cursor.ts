import { useEffect } from 'react';
import { useAuth } from './store';

/**
 * A constellation-reticle cursor: the native pointer is hidden and a small
 * lerped follower ring tracks the mouse, tightening over interactive elements.
 * Ignored on touch devices and when the user prefers reduced motion.
 */
export function useCustomCursor() {
  const on = useAuth((s) => Boolean(s.user?.settings.customCursor));

  useEffect(() => {
    if (!on) return;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (touch || reduced) return;

    const ring = document.createElement('div');
    ring.className = 'kanzen-cursor';
    const dot = document.createElement('div');
    dot.className = 'kanzen-cursor-dot';
    document.body.append(ring, dot);
    document.documentElement.classList.add('has-custom-cursor');

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let raf = 0;

    const move = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      dot.style.transform = `translate(${x}px, ${y}px)`;
      const over = (e.target as HTMLElement | null)?.closest(
        'button, a, [role="button"], input, select, textarea',
      );
      ring.classList.toggle('is-active', Boolean(over));
    };
    const tick = () => {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', move);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', move);
      cancelAnimationFrame(raf);
      ring.remove();
      dot.remove();
      document.documentElement.classList.remove('has-custom-cursor');
    };
  }, [on]);
}
