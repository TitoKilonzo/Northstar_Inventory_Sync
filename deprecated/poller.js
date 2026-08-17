'use strict';

/**
 * ============================ DEPRECATED =============================
 * Retired Day 4 when the client killed the polling method with 48 hours'
 * notice (no extension, no negotiating scope back). Replaced by
 * src/routes/webhook.js. Not imported or started anywhere in server.js -
 * this file does not run. Kept only as a record of the original spec; see
 * the Scope Delta Analysis for what changed and why.
 * =======================================================================
 *
 * ORIGINAL SPEC (Day 3): poll the warehouse API every 5 minutes and refresh
 * the stock cache.
 */

const cache = require('../src/cache');

const WAREHOUSE_URL = process.env.WAREHOUSE_URL || 'http://localhost:4001/inventory';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || String(5 * 60 * 1000), 10);

let timer = null;

async function pollOnce() {
  const startedAt = Date.now();
  try {
    const res = await fetch(WAREHOUSE_URL);
    if (!res.ok) {
      throw new Error(`warehouse API returned ${res.status}`);
    }
    const data = await res.json();
    cache.setMany(data.items || []);
    console.log(JSON.stringify({
      level: 'info',
      msg: 'poll succeeded',
      itemCount: (data.items || []).length,
      tookMs: Date.now() - startedAt,
    }));
  } catch (err) {
    // Original spec had no story for a failed poll beyond "log it and try
    // again in 5 minutes" - stale cache stays stale until the next tick.
    console.error(JSON.stringify({ level: 'error', msg: 'poll failed', error: err.message }));
  }
}

function start() {
  if (timer) return;
  pollOnce(); // don't wait 5 minutes for the first fill
  timer = setInterval(pollOnce, POLL_INTERVAL_MS);
  console.log(JSON.stringify({ level: 'info', msg: 'poller started', intervalMs: POLL_INTERVAL_MS }));
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop, pollOnce };
