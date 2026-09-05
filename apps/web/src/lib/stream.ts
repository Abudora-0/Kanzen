import { useEffect, useRef, useState } from 'react';
import type { StreamEvent } from '@kanzen/shared';
import { streamUrl } from './api';

export type SyncPulseState = {
  active: boolean;
  runs: Record<string, { provider: string; done: number; total: number; state: string }>;
  limiters: Record<string, { queued: number; reservoir: number }>;
  lastInsightAt: string | null;
};

const initial: SyncPulseState = { active: false, runs: {}, limiters: {}, lastInsightAt: null };

/**
 * Subscribe to the server sent event stream and fold sync events into a small
 * state object that drives the Sync Pulse panel and the animated nav logo.
 */
export function useSyncStream(enabled: boolean) {
  const [state, setState] = useState<SyncPulseState>(initial);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource(streamUrl(), { withCredentials: true });
    sourceRef.current = source;

    source.onmessage = (msg) => {
      let event: StreamEvent;
      try {
        event = JSON.parse(msg.data) as StreamEvent;
      } catch {
        return;
      }
      setState((prev) => {
        const next = { ...prev, runs: { ...prev.runs }, limiters: { ...prev.limiters } };
        if (event.type === 'sync:progress') {
          next.runs[event.runId] = {
            provider: event.provider,
            done: event.done,
            total: event.total,
            state: 'running',
          };
        } else if (event.type === 'sync:state') {
          const existing = next.runs[event.runId] ?? {
            provider: event.provider,
            done: 0,
            total: 1,
            state: event.state,
          };
          next.runs[event.runId] = { ...existing, state: event.state };
          if (event.state === 'done' || event.state === 'failed' || event.state === 'cancelled') {
            setTimeout(() => {
              setState((s) => {
                const runs = { ...s.runs };
                delete runs[event.runId];
                return { ...s, runs, active: Object.keys(runs).length > 0 };
              });
            }, 2500);
          }
        } else if (event.type === 'limiter') {
          next.limiters[event.provider] = {
            queued: event.queued,
            reservoir: event.reservoir,
          };
        } else if (event.type === 'insights:ready') {
          next.lastInsightAt = event.generatedAt;
        }
        next.active =
          Object.values(next.runs).some((r) => r.state === 'running' || r.state === 'queued') ||
          Object.values(next.limiters).some((l) => l.queued > 0);
        return next;
      });
    };

    source.onerror = () => {
      // EventSource retries on its own; nothing to do here.
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [enabled]);

  return state;
}
