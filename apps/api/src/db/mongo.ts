import mongoose from 'mongoose';
import { env } from '../env.js';
import { logger } from '../logger.js';

mongoose.set('strictQuery', true);

let connection: Promise<typeof mongoose> | null = null;

/**
 * Connect once and reuse the promise. On serverless the module is kept warm
 * between invocations so this avoids reconnect storms.
 */
export function connectMongo(uri = env.MONGODB_URI): Promise<typeof mongoose> {
  if (!connection) {
    connection = mongoose
      .connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
      })
      .then((m) => {
        logger.info({ host: m.connection.host, db: m.connection.name }, 'mongo connected');
        return m;
      })
      .catch((err) => {
        connection = null;
        throw err;
      });
  }
  return connection;
}

export async function disconnectMongo(): Promise<void> {
  if (connection) {
    await mongoose.disconnect();
    connection = null;
  }
}

export { mongoose };
