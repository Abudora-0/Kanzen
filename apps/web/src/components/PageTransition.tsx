import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { easeOutQuint } from '../lib/motion';

/**
 * A light per-route entrance. Opacity plus a small rise only, no exit that can
 * block the next route from mounting, and the element is fully readable at the
 * from-state (opacity 0 for ~0.3s at most).
 */
export function PageTransition({ children, id }: { children: ReactNode; id: string }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: easeOutQuint }}
    >
      {children}
    </motion.div>
  );
}
