'use strict';

const { hourFor } = require('./dateKey');

const round1 = (value) => Math.round(value * 10) / 10;
const minutesBetween = (from, to) =>
  from && to ? Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / 60000) : null;

/**
 * Effective service rate. We blend the configured average with the observed
 * rate for the most recently completed tokens of the day, so a teller who is
 * running slow this morning naturally pushes every ETA out.
 */
function effectiveServiceMinutes(service, recentServed, sampleSize = 8) {
  const configured = Number(service?.averageServiceMinutes) || 5;
  const samples = (recentServed || [])
    .map((token) => token.serviceMinutes ?? minutesBetween(token.calledAt, token.servedAt))
    .filter((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 180)
    .slice(0, sampleSize);

  if (samples.length < 3) return configured;
  const observed = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  // 70% observed / 30% configured keeps the estimate stable on wild outliers.
  return round1(observed * 0.7 + configured * 0.3) || configured;
}

const WAITING_STATUSES = ['waiting', 'serving'];

/** Compute stats for a full day of tokens (already scoped to one service/day). */
function computeDailyStats(tokens, { service, dateKey, timezone }) {
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    issued: 0,
    served: 0,
    waitSum: 0,
    waitCount: 0,
  }));

  let served = 0;
  let cancelled = 0;
  let noShow = 0;
  let waiting = 0;
  let waitSum = 0;
  let waitCount = 0;
  let serviceSum = 0;
  let serviceCount = 0;

  for (const token of tokens) {
    const issuedHour = hourFor(token.issuedAt, timezone);
    hourly[issuedHour].issued += 1;

    if (token.status === 'served' || token.status === 'no_show') {
      hourly[issuedHour].served += token.status === 'served' ? 1 : 0;
    }

    if (token.status === 'served') served += 1;
    if (token.status === 'cancelled') cancelled += 1;
    if (token.status === 'no_show') noShow += 1;
    if (WAITING_STATUSES.includes(token.status)) waiting += 1;

    const wait = token.waitMinutes ?? minutesBetween(token.issuedAt, token.calledAt);
    if (wait !== null && wait !== undefined && token.calledAt) {
      waitSum += wait;
      waitCount += 1;
      hourly[hourFor(token.calledAt, timezone)].waitSum += wait;
      hourly[hourFor(token.calledAt, timezone)].waitCount += 1;
    }

    const svc = token.serviceMinutes ?? minutesBetween(token.calledAt, token.servedAt);
    if (svc !== null && svc !== undefined && token.servedAt) {
      serviceSum += svc;
      serviceCount += 1;
    }
  }

  const hourlyBreakdown = hourly.map((bucket) => ({
    hour: bucket.hour,
    issued: bucket.issued,
    served: bucket.served,
    avgWaitMinutes: bucket.waitCount ? round1(bucket.waitSum / bucket.waitCount) : 0,
  }));

  const peak = hourlyBreakdown.reduce(
    (best, bucket) => (bucket.issued > best.issued ? bucket : best),
    { hour: null, issued: 0 }
  );

  return {
    serviceId: service?.id || null,
    serviceCode: service?.code || null,
    serviceName: service?.name || null,
    dateKey,
    totalIssued: tokens.length,
    totalServed: served,
    totalCancelled: cancelled,
    totalNoShow: noShow,
    totalWaiting: waiting,
    averageWaitMinutes: waitCount ? round1(waitSum / waitCount) : 0,
    averageServiceMinutes: serviceCount ? round1(serviceSum / serviceCount) : 0,
    peakHour: peak.issued > 0 ? peak.hour : null,
    hourlyBreakdown,
  };
}

module.exports = {
  round1,
  minutesBetween,
  effectiveServiceMinutes,
  computeDailyStats,
};
