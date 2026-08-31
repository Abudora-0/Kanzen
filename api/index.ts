import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '@kanzen/api';

/**
 * Vercel serverless entry. Every `/api/*` request is rewritten here by
 * vercel.json and handed to the same Express app that runs locally and on
 * Render. The module stays warm between invocations so the Mongo and Redis
 * connections are reused.
 */
const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
