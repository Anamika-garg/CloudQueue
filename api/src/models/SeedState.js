'use strict';

const mongoose = require('mongoose');

/**
 * Marks which campus days already have the demo dataset written.
 *
 * The unique index on `dateKey` doubles as an atomic lock: when several
 * serverless instances boot at the same time only the one that wins the insert
 * runs the seeder, so the demo data is never written twice.
 */
const seedStateSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    seededAt: { type: Date, default: Date.now },
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { versionKey: false }
);

const SeedState = mongoose.models.SeedState || mongoose.model('SeedState', seedStateSchema);

module.exports = SeedState;
