'use strict';

/**
 * Seeds MongoDB Atlas with the demo dataset (services, staff accounts and
 * three days of token history). Usage:
 *
 *   MONGODB_URI="mongodb+srv://..." npm run seed
 *
 * Safe to re-run: services are matched by code and users by email.
 */

const { config } = require('../src/config/env');
const { createMongoStore } = require('../src/db/mongo');
const { seedActivity } = require('../src/db/seed');

async function main() {
  if (!config.useMongo) {
    console.error('MONGODB_URI is not set. Add it to .env (or export it) and retry.');
    process.exit(1);
  }

  console.log('[seed] connecting to MongoDB Atlas...');
  const store = await createMongoStore();

  console.log('[seed] writing demo data...');
  const result = await seedActivity(store);
  console.log('[seed] done:', result);

  await store.close();
  process.exit(0);
}

main().catch((error) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
