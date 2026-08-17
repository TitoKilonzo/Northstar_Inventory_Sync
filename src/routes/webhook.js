'use strict';

/**
 * PIVOT SPEC (Day 4, effective within 48hrs of the client's notice):
 * the warehouse now pushes stock changes to us instead of us polling it.
 * This replaces src/poller.js as the cache's only ingestion path.
 *
 * Added HMAC signature verification that wasn't in the original spec at
 * all - polling only ever pulled from a URL we trusted; an inbound webhook
 * is the warehouse pushing INTO us, so anyone who finds the URL can post
 * fake stock updates unless we check who actually sent it. Documented as
 * an added item in the Scope Delta Analysis.
 */

const express = require('express');
const crypto = require('crypto');
const cache = require('../cache');

const router = express.Router();
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'dev-shared-secret-change-me';

function verifySignature(req, res, next) {
  const signature = req.get('X-Northstar-Signature');
  if (!signature) {
    return res.status(401).json({ error: 'missing X-Northstar-Signature header' });
  }

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.rawBody || '')
    .digest('hex');

  // Constant-time compare - a naive === here leaks timing info about how
  // many leading bytes matched, which defeats the point of signing.
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  const valid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

  if (!valid) {
    return res.status(401).json({ error: 'signature verification failed' });
  }
  next();
}

router.post('/webhook/inventory-update', verifySignature, (req, res) => {
  const { sku, stock, updatedAt } = req.body || {};

  if (!sku || typeof stock !== 'number') {
    return res.status(400).json({ error: 'sku (string) and stock (number) are required' });
  }

  cache.set(sku, stock, updatedAt);
  console.log(JSON.stringify({ level: 'info', msg: 'webhook update applied', sku, stock }));
  res.json({ ok: true, sku, stock });
});

module.exports = router;
