import type {
  ConnectionDto,
  EntryDto,
  InsightsPayload,
  Paginated,
  SyncRunDto,
  UserDto,
} from '@kanzen/shared';

const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'error',
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new ApiError(res.status, body.message ?? res.statusText, body.error);
  }
  return body as T;
}

export type ConnectionCatalogueItem = {
  provider: string;
  meta: {
    name: string;
    media: string[];
    auth: string;
    color: string;
    status: 'live' | 'stub';
    rateLimit: { requestsPerMinute: number; burst: number };
  };
  connected: boolean;
  configured: boolean;
};

export type LimiterSnapshot = {
  provider: string;
  queued: number;
  running: number;
  reservoir: number | null;
  breaker: 'open' | 'half-open' | 'closed';
  penaltyMs: number;
};

export const api = {
  register: (input: { email: string; password: string; displayName: string }) =>
    request<{ user: UserDto }>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) =>
    request<{ user: UserDto }>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  demo: () => request<{ user: UserDto }>('/auth/demo', { method: 'POST' }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: UserDto }>('/auth/me'),

  library: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v != null && v !== '') q.set(k, String(v));
    return request<Paginated<EntryDto>>(`/library?${q.toString()}`);
  },
  libraryStats: () =>
    request<{
      total: number;
      conflicts: number;
      byStatus: Record<string, number>;
      byType: Record<string, number>;
    }>('/library/stats'),
  libraryGraph: (params: { type?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params.type) q.set('type', params.type);
    if (params.status) q.set('status', params.status);
    return request<{
      nodes: {
        id: string;
        title: string;
        type: import('@kanzen/shared').MediaType;
        status: string;
        progress: number;
        score: number | null;
      }[];
      links: { source: string; target: string; kind: string }[];
      total: number;
      capped: boolean;
    }>(`/library/graph?${q.toString()}`);
  },
  entry: (id: string) =>
    request<{
      entry: EntryDto;
      work: EntryDto['work'];
      relatedProgress: { workId: string; status: string; progress: number }[];
    }>(`/library/${id}`),
  updateEntry: (
    id: string,
    patch: { status?: string; progress?: number; score?: number; notes?: string },
  ) =>
    request<{ entry: EntryDto }>(`/entries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  setWorkCover: (workId: string, coverImage: string) =>
    request<{ work: EntryDto['work'] }>(`/works/${workId}/cover`, {
      method: 'PATCH',
      body: JSON.stringify({ coverImage }),
    }),
  resolveConflict: (id: string, strategy: 'prefer-local' | 'prefer-remote' | 'prefer-furthest') =>
    request<{ entry: EntryDto }>(`/entries/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ strategy }),
    }),

  connections: () =>
    request<{
      connections: ConnectionDto[];
      catalogue: ConnectionCatalogueItem[];
      demoMode: boolean;
    }>('/connections'),
  connect: (provider: string) =>
    request<{ connection?: ConnectionDto; authUrl?: string; queued?: boolean }>(
      `/connections/${provider}/connect`,
      { method: 'POST' },
    ),
  connectCredentials: (
    provider: string,
    body: { username: string; password: string } | { token: string },
  ) =>
    request<{ connection: ConnectionDto; synced: boolean }>(
      `/connections/${provider}/credentials`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  disconnect: (provider: string) =>
    request<{ ok: true }>(`/connections/${provider}`, { method: 'DELETE' }),

  sync: (input: { provider?: string; mode?: 'full' | 'incremental' }) =>
    request<{ runs: SyncRunDto[] }>('/sync', { method: 'POST', body: JSON.stringify(input) }),
  cancelSync: (runId: string) =>
    request<{ run: SyncRunDto }>(`/sync/${runId}/cancel`, { method: 'POST' }),
  syncRuns: () => request<{ runs: SyncRunDto[] }>('/sync/runs'),
  syncStatus: () =>
    request<{
      limiters: LimiterSnapshot[];
      queue: { waiting: number; active: number; delayed: number; failed: number };
      activeRuns: SyncRunDto[];
    }>('/sync/status'),

  insights: () =>
    request<{ payload: InsightsPayload; computeMs: number; cached: boolean }>('/insights'),
  refreshInsights: () =>
    request<{ payload: InsightsPayload; computeMs: number }>('/insights/refresh', {
      method: 'POST',
    }),

  updateSettings: (patch: Record<string, unknown>) =>
    request<{ user: UserDto }>('/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
};

export const streamUrl = () => `${BASE}/stream`;
