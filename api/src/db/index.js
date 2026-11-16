'use strict';

const { config } = require('../config/env');
const { createMongoStore } = require('./mongo');
const { createMemoryStore } = require('./memory');

/**
 * The store is created exactly once per process and reused by every request
 * (important on Vercel, where a warm function instance serves many requests
 * and re-connecting to Atlas on each invocation would be wasteful).
 */
let storePromise = null;

function getStore() {
  if (!storePromise) {
    storePromise = (config.useMongo ? createMongoStore() : createMemoryStore()).catch((error) => {
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
