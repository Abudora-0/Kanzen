import pino from 'pino';
import { isProd, isTest } from './env.js';

export const logger = pino({
  level: isTest ? 'silent' : isProd ? 'info' : 'debug',
  // pino-pretty runs in a worker thread; skip it under test and in production.
  transport:
    isProd || isTest
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
});
