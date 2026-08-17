'use strict';

const express = require('express');
const cache = require('../cache');

const router = express.Router();

// "Is this in stock?" - the actual product requirement. Untouched by the
// Day 4 pivot: it reads the cache, and doesn't know or care how the cache
// got filled.
router.get('/stock/:sku', (req, res) => {
  const item = cache.get(req.params.sku);
  if (!item) {
    return res.status(404).json({ error: `no stock data for sku ${req.params.sku}` });
  }
  res.json(item);
});

router.get('/stock', (req, res) => {
  res.json({
    items: cache.all(),
    lastSyncedAt: cache.getLastSyncedAt(),
  });
});

module.exports = router;
