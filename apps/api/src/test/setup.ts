import { afterAll, beforeAll } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.PROVIDERS_DEMO_MODE = 'true';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-000000000000000';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-000000000000000';
process.env.TOKEN_ENCRYPTION_KEY =
  '1111111111111111111111111111111111111111111111111111111111111111';

let mongod: MongoMemoryServer | undefined;

beforeAll(async () => {
  // CI provides a real MongoDB service; locally we spin an ephemeral one up.
  if (process.env.TEST_MONGODB_URI) {
    process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
  } else {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('kanzen_test');
  }
  const { connectMongo } = await import('../db/mongo.js');
  await connectMongo(process.env.MONGODB_URI);
});

afterAll(async () => {
  const [{ disconnectMongo }, { closeRedis }, { closeQueues }] = await Promise.all([
    import('../db/mongo.js'),
    import('../redis/redis.js'),
    import('../queue/queues.js'),
  ]);
  await Promise.allSettled([closeQueues(), closeRedis(), disconnectMongo()]);
  await mongod?.stop();
});
