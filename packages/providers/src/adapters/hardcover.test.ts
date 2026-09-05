import { afterEach, describe, expect, it, vi } from 'vitest';
import { HardcoverProvider } from './hardcover.js';
import type { SyncContext } from '../types.js';

const ctx = (over: Partial<SyncContext> = {}): SyncContext => ({
  userId: 'u1',
  connectionId: 'c1',
  tokens: { accessToken: 'tok' },
  demo: false,
  log: () => undefined,
  ...over,
});

const res = (body: unknown) =>
  ({ status: 200, headers: new Headers(), text: async () => JSON.stringify(body) }) as Response;

afterEach(() => vi.restoreAllMocks());

describe('HardcoverProvider', () => {
  it('is always configured (no app-level credentials needed)', () => {
    expect(new HardcoverProvider().isConfigured()).toBe(true);
  });

  it('exchanges a pasted token for a validated identity', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(res({ data: { me: [{ id: 42, username: 'reader' }] } }));

    const out = await new HardcoverProvider().exchangeCredentials!({ token: 'my-token' });
    expect(out.handle).toBe('reader');
    expect(out.tokens.accessToken).toBe('my-token');
    expect(out.tokens.accountId).toBe('42');
    const init = fetchMock.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer my-token');
  });

  it('rejects a token Hardcover does not recognise', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      res({ errors: [{ message: 'invalid token' }] }),
    );
    await expect(new HardcoverProvider().exchangeCredentials!({ token: 'bad' })).rejects.toThrow();
  });

  it('maps a user_book onto the canonical shape', async () => {
    const page = {
      data: {
        me: [
          {
            user_books: [
              {
                id: 900,
                status_id: 2,
                rating: 4.5,
                read_count: 0,
                updated_at: '2026-02-01T00:00:00.000Z',
                book: {
                  id: 55,
                  title: 'Piranesi',
                  pages: 245,
                  release_year: 2020,
                  image: { url: 'https://hardcover/cover.jpg' },
                },
                user_book_reads: [{ progress_pages: 120 }],
              },
            ],
          },
        ],
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(res(page));

    const { items } = await new HardcoverProvider().fetchLibrary(ctx());
    expect(items).toHaveLength(1);
    const e = items[0]!;
    expect(e.providerEntryId).toBe('900');
    expect(e.work.type).toBe('book');
    expect(e.work.title.english).toBe('Piranesi');
    expect(e.work.externalIds).toEqual({ hardcover: 55 });
    expect(e.work.coverImage).toBe('https://hardcover/cover.jpg');
    expect(e.work.chapters).toBe(245);
    expect(e.status).toBe('current');
    expect(e.progress).toBe(120);
    expect(e.score).toBe(9);
  });

  it('treats a currently-reading entry with a prior read as repeating', async () => {
    const page = {
      data: {
        me: [
          {
            user_books: [
              {
                id: 901,
                status_id: 2,
                rating: null,
                read_count: 1,
                updated_at: '2026-02-01T00:00:00.000Z',
                book: { id: 56, title: 'Dune', pages: 412, release_year: 1965, image: null },
                user_book_reads: [],
              },
            ],
          },
        ],
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(res(page));

    const { items } = await new HardcoverProvider().fetchLibrary(ctx());
    expect(items[0]!.status).toBe('repeating');
    expect(items[0]!.progress).toBe(0);
    expect(items[0]!.score).toBeNull();
  });

  it('writes back status, rating, and progress, creating a read entry if none exists', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(res({ data: { update_user_book: { id: 900 } } }))
      .mockResolvedValueOnce(res({ data: { user_book_reads: [] } }))
      .mockResolvedValueOnce(res({ data: { insert_user_book_read: { id: 1 } } }));

    await new HardcoverProvider().updateEntry(ctx(), {
      providerEntryId: '900',
      externalWorkId: '55',
      status: 'completed',
      progress: 245,
      score: 9,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const updateBody = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(updateBody.variables.object).toEqual({ status_id: 3, rating: 4.5 });
    const insertBody = JSON.parse(String(fetchMock.mock.calls[2]![1]!.body));
    expect(insertBody.variables.read.progress_pages).toBe(245);
  });
});
