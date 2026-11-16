'use strict';

const mongoose = require('mongoose');

const hourlySchema = new mongoose.Schema(
  {
    hour: { type: Number, min: 0, max: 23 },
    issued: { type: Number, default: 0 },
    served: { type: Number, default: 0 },
    avgWaitMinutes: { type: Number, default: 0 },
  },
  { _id: false }
);

/**
 * Materialised daily roll-up. In this build the admin stats endpoint computes
 * the numbers from the token collection and upserts the result here, so the
 * collection doubles as a report cache / export source. At campus scale a
 * nightly aggregation job can own this collection instead.
 */
const dailyStatSchema = new mongoose.Schema(
  {
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    totalIssued: { type: Number, default: 0 },
    totalServed: { type: Number, default: 0 },
    totalCancelled: { type: Number, default: 0 },
    totalNoShow: { type: Number, default: 0 },
    totalWaiting: { type: Number, default: 0 },
    averageWaitMinutes: { type: Number, default: 0 },
    averageServiceMinutes: { type: Number, default: 0 },
    peakHour: { type: Number, default: null },
    hourlyBreakdown: { type: [hourlySchema], default: [] },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false }
);

dailyStatSchema.index({ serviceId: 1, dateKey: 1 }, { unique: true });

const DailyStat = mongoose.models.DailyStat || mongoose.model('DailyStat', dailyStatSchema);

module.exports = DailyStat;
