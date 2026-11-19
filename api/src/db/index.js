'use strict';

const { config } = require('../config/env');
const { createMongoStore } = require('./mongo');
const { createMemoryStore } = require('./memory');
const { ensureDemoDataset } = require('./seed');

/**
 * The store is created exactly once per process and reused by every request
 * (important on Vercel, where a warm function instance serves many requests
 * and re-connecting to Atlas on each invocation would be wasteful).
 *
 * Demo data is written before the store is handed to the first request:
 *  - demo mode, or SEED_DEMO_DATA=true -> refreshed once per campus day
 *  - any other deployment              -> bootstrapped only when it is empty
 * A failure here is logged but never blocks the API: an operator can still sign
 * in and create services by hand.
 */
let storePromise = null;

async function initStore(store) {
  try {
    const result = await ensureDemoDataset(store);
    if (result && !result.skipped) {
      console.log(
        `[cloudqueue] demo dataset ready: ${result.services} services, ${result.tokens} tokens (${result.dateKey})`
      );
    }
  } catch (error) {
    console.error('[cloudqueue] demo dataset could not be written:', error.message);
  }
  return store;
}

function getStore() {
  if (!storePromise) {
    const create = config.useMongo ? createMongoStore : createMemoryStore;
    storePromise = create()
      .then(initStore)
      .catch((error) => {
        storePromise = null;
        throw error;
      });
  }
  return storePromise;
}

function resetStoreForTests() {
  storePromise = null;
}

module.exports = { getStore, resetStoreForTests };
