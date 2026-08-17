'use strict';

/**
 * Northstar Retail Co. - live inventory sync service.
 *
 * PIVOT SPEC (Day 4, effective within 48hrs): the warehouse pushes stock
 * changes via webhook instead of us polling it every 5 minutes.
 *
 * The poller from the original spec is retired - see /deprecated/poller.js.
 * It is not imported or started anywhere in this file.
 */

const express = require('express');
const stockRoutes = require('./src/routes/stock');
const webhookRoutes = require('./src/routes/webhook');

const PORT = process.env.PORT || 3000;

const app = express();

// Capture the raw body alongside the parsed one so the webhook route can
// verify the HMAC signature against exactly what was sent, not a
// re-serialized (and possibly differently-ordered) version of it.
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', stockRoutes);
app.use('/api', webhookRoutes);

app.listen(PORT, () => {
  console.log(`[northstar-inventory-sync] listening on :${PORT} (webhook push model)`);
});
