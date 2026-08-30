import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '@kanzen/api';

/**
 * Vercel serverless entry. The same Express app that runs locally and on Render
 * is handed the request. The module stays warm between invocations so Mongo and
 * Redis connections are reused.
 */
const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
