import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../components/Icon';

type Toast = { id: number; message: string; tone: 'ok' | 'warn' | 'error' };
type ToastApi = {
  show: (message: string, tone?: Toast['tone']) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const show = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = (seq.current += 1);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              className="glass pointer-events-auto flex max-w-xs items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink shadow-lg"
            >
              <span
                className={
                  t.tone === 'error'
                    ? 'text-vermillion-bright'
                    : t.tone === 'warn'
                      ? 'text-gold'
                      : 'text-aurora-teal'
                }
              >
                <Icon name={t.tone === 'ok' ? 'check' : 'spark'} size={16} />
              </span>
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { show: () => undefined };
}
