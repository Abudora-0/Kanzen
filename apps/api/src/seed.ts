import { connectMongo, disconnectMongo } from './db/mongo.js';
import { logger } from './logger.js';
import { seedDatabase } from './seed/seedDatabase.js';

async function main() {
  await connectMongo();
  const result = await seedDatabase();
  logger.info(result, 'seed complete');
  await disconnectMongo();
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'seed failed');
  process.exit(1);
});
