/** The four media domains Kanzen tracks. */
export const MEDIA_TYPES = ['anime', 'manga', 'book', 'movie'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/** Grouping used across the UI for tab and cluster colours. */
export const MEDIA_GROUP: Record<MediaType, 'watch' | 'read'> = {
  anime: 'watch',
  movie: 'watch',
  manga: 'read',
  book: 'read',
};

export const MEDIA_LABEL: Record<MediaType, string> = {
  anime: 'Anime',
  manga: 'Manga',
  book: 'Books',
  movie: 'Movies',
};

/** How progress is counted for a given media type. */
export const PROGRESS_UNIT: Record<MediaType, string> = {
  anime: 'episodes',
  manga: 'chapters',
  book: 'pages',
  movie: 'minutes',
};

export type TitleSet = {
  romaji?: string;
  english?: string;
  native?: string;
};

export type WorkRelation = {
  relationType:
    | 'sequel'
    | 'prequel'
    | 'side_story'
    | 'parent'
    | 'adaptation'
    | 'alternative'
    | 'spin_off'
    | 'other';
  workId: string;
};

export type ExternalIds = {
  anilist?: number;
  mal?: number;
  kitsu?: number;
  tmdb?: number;
  hardcover?: number;
  imdb?: string;
  isbn?: string;
};
