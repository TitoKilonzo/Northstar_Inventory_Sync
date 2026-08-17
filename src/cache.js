'use strict';

/**
 * In-memory stock cache. Deliberately ingestion-agnostic: it doesn't care
 * whether an update came from the Day 3 poller or the Day 4+ webhook -
 * both just call set(). That boundary is what kept the Day 4 pivot from
 * touching the query endpoint at all (see Scope Delta Analysis).
 */

const store = new Map();
let lastSyncedAt = null;

function set(sku, stock, sourceUpdatedAt) {
  store.set(sku, {
    sku,
    stock,
    sourceUpdatedAt: sourceUpdatedAt || new Date().toISOString(),
    cachedAt: new Date().toISOString(),
  });
  lastSyncedAt = new Date().toISOString();
}

function setMany(items) {
  items.forEach((item) => set(item.sku, item.stock, item.updatedAt));
}

function get(sku) {
  return store.get(sku) || null;
}

function all() {
  return Array.from(store.values());
}

function getLastSyncedAt() {
  return lastSyncedAt;
}

function clear() {
  store.clear();
  lastSyncedAt = null;
}

module.exports = { set, setMany, get, all, getLastSyncedAt, clear };
