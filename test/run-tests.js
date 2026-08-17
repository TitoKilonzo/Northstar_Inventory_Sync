'use strict';

/**
 * Lightweight regression check, run against a live instance of the service
 * (see README for how to start it). No test framework - just fetch calls
 * and assertions, kept intentionally simple so it's obvious what's being
 * checked. Covers the "did the pivot break old features?" question from
 * the Assignment 2 rubric directly.
 */

const crypto = require('crypto');

const SYNC_URL = process.env.SYNC_URL || 'http://localhost:3000';
const WAREHOUSE_URL = process.env.WAREHOUSE_URL || 'http://localhost:4001';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'dev-shared-secret-change-me';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`  ok - ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL - ${label}`);
  }
}

function sign(body) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

async function main() {
  console.log('Regression: query endpoint unchanged post-pivot');
  const listRes = await fetch(`${SYNC_URL}/api/stock`);
  const listBody = await listRes.json();
  assert(listRes.status === 200, 'GET /api/stock returns 200');
  assert(Array.isArray(listBody.items), 'GET /api/stock returns an items array');

  console.log('\nPivot: webhook push actually updates the cache');
  await fetch(`${WAREHOUSE_URL}/_test/set-stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sku: 'NS-TEST-1', stock: 17 }),
  });
  const pushRes = await fetch(`${WAREHOUSE_URL}/_test/push-to-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sku: 'NS-TEST-1', syncServiceUrl: `${SYNC_URL}/api/webhook/inventory-update` }),
  });
  assert(pushRes.status === 200, 'warehouse push to webhook succeeds');

  const afterPush = await fetch(`${SYNC_URL}/api/stock/NS-TEST-1`);
  const afterPushBody = await afterPush.json();
  assert(afterPushBody.stock === 17, 'cache reflects the pushed stock value');

  console.log('\nSecurity: webhook rejects unsigned/forged requests');
  const forged = '{"sku":"NS-TEST-1","stock":999999}';
  const badSig = await fetch(`${SYNC_URL}/api/webhook/inventory-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Northstar-Signature': 'not-a-real-signature' },
    body: forged,
  });
  assert(badSig.status === 401, 'bad signature is rejected with 401');

  const noSig = await fetch(`${SYNC_URL}/api/webhook/inventory-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: forged,
  });
  assert(noSig.status === 401, 'missing signature is rejected with 401');

  const goodSig = sign(forged);
  const validPush = await fetch(`${SYNC_URL}/api/webhook/inventory-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Northstar-Signature': goodSig },
    body: forged,
  });
  assert(validPush.status === 200, 'correctly-signed request is accepted');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test run crashed:', err);
  process.exit(1);
});
