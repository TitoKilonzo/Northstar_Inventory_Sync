# Northstar Inventory Sync

Live inventory sync service for Northstar Retail Co.'s support tool, so
"is this in stock?" stays accurate.

**Current state: post-pivot (webhook push model).** See
`SCOPE_DELTA_ANALYSIS.md` for what changed on Day 4 and why. The original
Day 3 poller is retired in `deprecated/poller.js` and is not running.

## Architecture

```
mock-warehouse/server.js   -> test fixture standing in for Northstar's real warehouse system
server.js                  -> Express app entrypoint
src/cache.js                  in-memory stock cache (ingestion-agnostic)
src/routes/stock.js            GET /api/stock, GET /api/stock/:sku
src/routes/webhook.js          POST /api/webhook/inventory-update (HMAC-verified)
deprecated/poller.js           retired Day 3 poller - not imported anywhere
test/run-tests.js              regression suite against a live instance
```

## Running it locally

Two processes: the mock warehouse fixture, then the sync service.

```bash
# terminal 1
cd mock-warehouse && npm install && npm start   # listens on :4001

# terminal 2
npm install && npm start                        # listens on :3000
```

Check it's alive:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/stock
```

Simulate the warehouse pushing a stock change:

```bash
curl -X POST http://localhost:4001/_test/set-stock \
  -H 'Content-Type: application/json' \
  -d '{"sku":"NS-1002","stock":3}'

curl -X POST http://localhost:4001/_test/push-to-webhook \
  -H 'Content-Type: application/json' \
  -d '{"sku":"NS-1002"}'

curl http://localhost:3000/api/stock/NS-1002   # should show stock: 3
```

## Running the tests

With both servers up:

```bash
npm test
```

Covers: the query endpoint still working post-pivot (no regression),
a real warehouse push landing in the cache, and the webhook rejecting
both unsigned and badly-signed requests.

## Environment variables

| Variable | Default | Used by |
|---|---|---|
| `PORT` | `3000` | sync service |
| `WEBHOOK_SECRET` | `dev-shared-secret-change-me` | sync service + mock-warehouse (must match on both sides) |
| `MOCK_WAREHOUSE_PORT` | `4001` | mock-warehouse |
| `POLL_INTERVAL_MS` | `300000` | deprecated poller only - unused in the running service |

In a real deploy, `WEBHOOK_SECRET` is a rotated shared secret (or a
per-partner key if Northstar ever adds a second warehouse feed), not a
hardcoded default.
