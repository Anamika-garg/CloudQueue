'use strict';

const { config } = require('../config/env');

/**
 * Queue state is partitioned by campus-local calendar day (the `dateKey`).
 * Offices reset every morning, so "today" must follow the campus clock rather
 * than the server's UTC clock (Vercel functions run in UTC).
 */
function dateKeyFor(date = new Date(), timeZone = config.timezone) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && value === parsed.toISOString().slice(0, 10);
}

/** Hour (0-23) of a timestamp in campus-local time. */
function hourFor(date, timeZone = config.timezone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(date));
  const hour = parts.find((part) => part.type === 'hour');
  return hour ? Number(hour.value) : 0;
}

/** Yesterday / tomorrow keys, used by analytics shortcuts and cleanup jobs. */
function shiftDateKey(dateKey, days) {
  const base = new Date(`${dateKey}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

module.exports = { dateKeyFor, isValidDateKey, hourFor, shiftDateKey };
