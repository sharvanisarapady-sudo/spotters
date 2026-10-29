/**
 * Lightweight in-memory TTL cache to eliminate repeated cross-region cloud DB round-trips
 * for read-heavy catalog data (systems, test blocks, published cases, grading info).
 * Automatically invalidated whenever Admin creates, updates, publishes, or deletes content.
 */
const store = new Map();

const cache = {
  get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  },

  set(key, value, ttlMs = 120000) {
    store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  },

  async getOrSet(key, ttlMs, loaderFn) {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await loaderFn();
    if (value !== undefined && value !== null) {
      this.set(key, value, ttlMs);
    }
    return value;
  },

  invalidatePrefix(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) {
        store.delete(key);
      }
    }
  },

  invalidateContent() {
    for (const key of store.keys()) {
      if (
        key.startsWith('systems:') ||
        key.startsWith('tests:') ||
        key.startsWith('practice:') ||
        key.startsWith('navai:') ||
        key.startsWith('grading:')
      ) {
        store.delete(key);
      }
    }
  },

  clearAll() {
    store.clear();
  },
};

module.exports = cache;
