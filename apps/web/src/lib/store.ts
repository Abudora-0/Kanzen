import { create } from 'zustand';
import type { UserDto } from '@kanzen/shared';
import { api } from './api';

type AuthState = {
  user: UserDto | null;
  loading: boolean;
  bootstrap: () => Promise<void>;
  setUser: (user: UserDto | null) => void;
  logout: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  bootstrap: async () => {
    try {
      const { user } = await api.me();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  setUser: (user) => set({ user }),
  logout: async () => {
    await api.logout().catch(() => undefined);
    set({ user: null });
  },
}));

type MotionState = {
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
};

const prefersReduced =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useMotionPref = create<MotionState>((set) => ({
  reduceMotion: prefersReduced,
  setReduceMotion: (v) => {
    set({ reduceMotion: v });
    document.documentElement.dataset.motion = v ? 'off' : 'on';
  },
}));
