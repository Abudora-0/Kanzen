import { afterEach, describe, expect, it, vi } from 'vitest';
import { MalProvider } from './mal.js';
import type { SyncContext } from '../types.js';

const ctx = (): SyncContext => ({
  userId: 'u1',
  connectionId: 'c1',
  tokens: { accessToken: 'tok' },
  demo: false,
  log: () => undefined,
});

function jsonResponse(body: unknown) {
  return {
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
  } as Response;
}

afterEach(() => vi.restoreAllMocks());

describe('MalProvider', () => {
  it('reports configured only with a client id', () => {
    expect(new MalProvider({}).isConfigured()).toBe(false);
    expect(new MalProvider({ clientId: 'abc' }).isConfigured()).toBe(true);
  });

  it('builds a plain-PKCE authorize url', () => {
    const url = new MalProvider({ clientId: 'abc' }).getAuthUrl({
      state: 's1',
      pkce: { verifier: 'v1' },
      redirectUri: 'https://app.test/cb',
    });
    const p = new URL(url).searchParams;
    expect(p.get('code_challenge')).toBe('v1');
    expect(p.get('code_challenge_method')).toBe('plain');
    expect(p.get('state')).toBe('s1');
    expect(p.get('redirect_uri')).toBe('https://app.test/cb');
  });

  it('maps an anime list entry onto the canonical shape', async () => {
    const anime = {
      data: [
        {
          node: {
            id: 5114,
            title: 'Fullmetal Alchemist: Brotherhood',
            main_picture: { large: 'https://img/large.jpg', medium: 'https://img/med.jpg' },
            alternative_titles: {
              en: 'FMA: Brotherhood',
              ja: '鋼の錬金術師',
              synonyms: ['Hagaren'],
            },
            media_type: 'tv',
            start_season: { year: 2009 },
            mean: 9.1,
            genres: [{ name: 'Action' }, { name: 'Adventure' }],
            num_episodes: 64,
          },
          list_status: {
            status: 'completed',
            score: 10,
            num_episodes_watched: 64,
            is_rewatching: false,
            num_times_rewatched: 1,
            updated_at: '2026-01-02T03:04:05+00:00',
            finish_date: '2025-12-30',
          },
        },
      ],
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(anime))
      .mockResolvedValueOnce(jsonResponse({ data: [] }));

    const { items } = await new MalProvider({ clientId: 'abc' }).fetchLibrary(ctx());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(1);
    const e = items[0]!;
    expect(e.work.type).toBe('anime');
    expect(e.work.externalIds).toEqual({ mal: 5114 });
    expect(e.work.coverImage).toBe('https://img/large.jpg');
    expect(e.work.episodes).toBe(64);
    expect(e.status).toBe('completed');
    expect(e.progress).toBe(64);
    expect(e.score).toBe(10);
    expect(e.repeats).toBe(1);
    expect(e.completedAt).toBe('2025-12-30T00:00:00.000Z');
    expect(e.providerEntryId).toBe('mal-anime-5114');
  });

  it('treats a rewatching entry as repeating and skips stale rows on incremental', async () => {
    const page = {
      data: [
        {
          node: { id: 1, title: 'A', num_episodes: 12 },
          list_status: {
            status: 'completed',
            score: 0,
            num_episodes_watched: 12,
            is_rewatching: true,
            updated_at: '2026-06-01T00:00:00Z',
          },
        },
        {
          node: { id: 2, title: 'B', num_episodes: 12 },
          list_status: {
            status: 'watching',
            score: 7,
            num_episodes_watched: 3,
            updated_at: '2020-01-01T00:00:00Z',
          },
        },
      ],
    };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(page))
      .mockResolvedValueOnce(jsonResponse({ data: [] }));

    const { items } = await new MalProvider({ clientId: 'abc' }).fetchLibrary({
      ...ctx(),
      since: new Date('2026-01-01T00:00:00Z'),
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.status).toBe('repeating');
    expect(items[0]!.score).toBeNull();
  });
});
