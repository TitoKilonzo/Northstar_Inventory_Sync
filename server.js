'use strict';

/**
 * Northstar Retail Co. - live inventory sync service.
 * ORIGINAL SPEC (Day 3): poll a warehouse API every 5 minutes, cache stock,
 * expose a query endpoint so the support tool can answer "is this in stock?".
 */

const express = require('express');
const stockRoutes = require('./src/routes/stock');
const poller = require('./src/poller');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', stockRoutes);

app.listen(PORT, () => {
  console.log(`[northstar-inventory-sync] listening on :${PORT}`);
  poller.start();
});
