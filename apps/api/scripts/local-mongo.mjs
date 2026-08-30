// Local development helper: run an ephemeral MongoDB on the default port so the
// API and seed script work without a system install. Not used in production.
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongod = await MongoMemoryServer.create({
  instance: { port: 27017, dbName: 'kanzen' },
});

console.log(`[local-mongo] ready at ${mongod.getUri('kanzen')}`);

const shutdown = async () => {
  await mongod.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
