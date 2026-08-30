import { z } from 'zod';

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true' || v === '1'));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  API_PUBLIC_URL: z.string().default('http://localhost:4000'),

  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/kanzen'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me-please'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-me-please'),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .default('0000000000000000000000000000000000000000000000000000000000000000'),

  PROVIDERS_DEMO_MODE: bool(true),

  DEMO_EMAIL: z.string().default('demo@kanzen.app'),
  DEMO_PASSWORD: z.string().default('constellation'),

  ANILIST_CLIENT_ID: z.string().optional(),
  ANILIST_CLIENT_SECRET: z.string().optional(),
  TMDB_READ_TOKEN: z.string().optional(),

  CRON_SECRET: z.string().default('dev-cron-secret'),

  /** Set by the worker process so queue consumers start. */
  ROLE: z.enum(['api', 'worker', 'all']).default('api'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed');
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Real provider credentials present, so OAuth can run for that provider. */
export const providerConfig = {
  anilist: {
    clientId: env.ANILIST_CLIENT_ID,
    clientSecret: env.ANILIST_CLIENT_SECRET,
  },
  tmdb: {
    readToken: env.TMDB_READ_TOKEN,
  },
};

export const demoMode = env.PROVIDERS_DEMO_MODE;
