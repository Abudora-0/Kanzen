import { afterEach, describe, expect, it, vi } from 'vitest';
import { KitsuProvider } from './kitsu.js';
import type { SyncContext } from '../types.js';

const ctx = (over: Partial<SyncContext> = {}): SyncContext => ({
  userId: 'u1',
  connectionId: 'c1',
  tokens: { accessToken: 'tok', accountId: '42' },
  demo: false,
  log: () => undefined,
  ...over,
});

const res = (body: unknown) =>
  ({ status: 200, headers: new Headers(), text: async () => JSON.stringify(body) }) as Response;

afterEach(() => vi.restoreAllMocks());

describe('KitsuProvider', () => {
  it('exchanges a username and password for a token and handle', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(res({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }))
      .mockResolvedValueOnce(
        res({ data: [{ id: '42', type: 'users', attributes: { name: 'reader' } }] }),
      );

    const out = await new KitsuProvider().exchangeCredentials!({
      username: 'me@example.com',
      password: 'secret',
    });
    expect(out.handle).toBe('reader');
    expect(out.tokens.accessToken).toBe('at');
    expect(out.tokens.accountId).toBe('42');
    const firstBody = String(fetchMock.mock.calls[0]![1]!.body);
    expect(firstBody).toContain('grant_type=password');
    expect(firstBody).toContain('secret');
  });

  it('maps a library-entry with its included media onto the canonical shape', async () => {
    const page = {
      data: [
        {
          id: '900',
          type: 'libraryEntries',
          attributes: {
            status: 'completed',
            progress: 24,
            ratingTwenty: 18,
            reconsuming: false,
            reconsumeCount: 0,
            finishedAt: '2025-11-02T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z',
          },
          relationships: {
            media: { data: { id: '1', type: 'anime' } },
            mappings: { data: { id: 'm1', type: 'mappings' } },
          },
        },
      ],
      included: [
        {
          id: '1',
          type: 'anime',
          attributes: {
            canonicalTitle: 'Vinland Saga',
            titles: { en: 'Vinland Saga', ja_jp: 'ヴィンランド・サガ' },
            posterImage: { large: 'https://kitsu/poster.jpg' },
            episodeCount: 24,
            averageRating: '82.4',
            startDate: '2019-07-08',
            subtype: 'TV',
          },
        },
        {
          id: 'm1',
          type: 'mappings',
          attributes: { externalSite: 'myanimelist/anime', externalId: '37521' },
        },
      ],
      links: {},
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(res(page));

    const { items } = await new KitsuProvider().fetchLibrary(ctx());
    expect(items).toHaveLength(1);
    const e = items[0]!;
    expect(e.providerEntryId).toBe('900');
    expect(e.work.type).toBe('anime');
    expect(e.work.title.english).toBe('Vinland Saga');
    expect(e.work.externalIds).toMatchObject({ kitsu: 1, mal: 37521 });
    expect(e.work.coverImage).toBe('https://kitsu/poster.jpg');
    expect(e.work.episodes).toBe(24);
    expect(e.status).toBe('completed');
    expect(e.progress).toBe(24);
    expect(e.score).toBe(9);
  });

  it('needs a Kitsu account id to fetch', async () => {
    await expect(
      new KitsuProvider().fetchLibrary(ctx({ tokens: { accessToken: 'x' } })),
    ).rejects.toThrow();
  });
});
