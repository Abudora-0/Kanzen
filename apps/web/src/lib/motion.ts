import { useEffect, useRef, useState } from 'react';
import type { Transition } from 'framer-motion';
import { useMotionPref } from './store';

export const springSoft: Transition = { type: 'spring', stiffness: 260, damping: 26 };
export const easeOutQuint: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Trigger an entrance animation when an element scrolls into view. A timeout
 * failsafe reveals the element even if the IntersectionObserver never fires
 * (throttled tabs, jsdom), so content is never left hidden.
 */
export function useInViewReveal<T extends HTMLElement = HTMLDivElement>(delayMs = 0) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  const { reduceMotion } = useMotionPref();

  useEffect(() => {
    if (reduceMotion) {
      setShown(true);
      return;
    }
    const reveal = () => setShown(true);
    const failsafe = setTimeout(reveal, 1100 + delayMs);

    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      reveal();
      return () => clearTimeout(failsafe);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setTimeout(reveal, delayMs);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => {
      clearTimeout(failsafe);
      io.disconnect();
    };
  }, [reduceMotion, delayMs]);

  return {
    ref,
    className: reduceMotion || shown ? 'reveal-in' : 'opacity-0',
  };
}
