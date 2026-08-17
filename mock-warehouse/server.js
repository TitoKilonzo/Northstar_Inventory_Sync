'use strict';

/**
 * Stand-in for Northstar's real warehouse system. Not part of the graded
 * deliverable - exists so the sync service has something real to poll
 * against (Day 3) and, later, something that can fire webhook pushes at it
 * (Day 4+). Nothing about this file is "the product."
 */

const express = require('express');
const crypto = require('crypto');

const PORT = process.env.MOCK_WAREHOUSE_PORT || 4001;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'dev-shared-secret-change-me';

const app = express();
app.use(express.json());

let inventory = {
  'NS-1001': { sku: 'NS-1001', stock: 42, updatedAt: new Date().toISOString() },
  'NS-1002': { sku: 'NS-1002', stock: 7, updatedAt: new Date().toISOString() },
  'NS-1003': { sku: 'NS-1003', stock: 0, updatedAt: new Date().toISOString() },
  'NS-1004': { sku: 'NS-1004', stock: 130, updatedAt: new Date().toISOString() },
};

// What the Day 3 poller hits every 5 minutes.
app.get('/inventory', (req, res) => {
  res.json({ items: Object.values(inventory) });
});

// Test-only lever: mutate stock so we can prove the poller (Day 3) or the
// webhook receiver (Day 4+) actually picks up a real change.
app.post('/_test/set-stock', (req, res) => {
  const { sku, stock } = req.body || {};
  if (!sku || typeof stock !== 'number') {
    return res.status(400).json({ error: 'sku (string) and stock (number) are required' });
  }
  inventory[sku] = { sku, stock, updatedAt: new Date().toISOString() };
  res.json({ ok: true, item: inventory[sku] });
});

// Post-pivot: instead of waiting to be polled, the warehouse pushes changes
// straight at the sync service's webhook endpoint.
app.post('/_test/push-to-webhook', async (req, res) => {
  const { sku, syncServiceUrl } = req.body || {};
  const item = inventory[sku];
  if (!item) {
    return res.status(404).json({ error: `unknown sku ${sku}` });
  }

  const target = syncServiceUrl || 'http://localhost:3000/api/webhook/inventory-update';
  const payload = JSON.stringify({ sku: item.sku, stock: item.stock, updatedAt: item.updatedAt });
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');

  try {
    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Northstar-Signature': signature,
      },
      body: payload,
    });
    const body = await response.json();
    res.status(response.status).json({ pushed: item, receiverResponse: body });
  } catch (err) {
    res.status(502).json({ error: `could not reach sync service: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`[mock-warehouse] listening on :${PORT}`);
});
