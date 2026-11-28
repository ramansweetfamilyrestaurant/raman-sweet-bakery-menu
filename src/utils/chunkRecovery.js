export const CHUNK_RELOAD_KEY = 'last-chunk-reload';
export const CHUNK_RELOAD_COOLDOWN_MS = 8000;

function getSessionStorageSafe() {
  try {
    return (typeof window !== 'undefined' && window.sessionStorage) || null;
  } catch {
    return null;
  }
}

export function readLastChunkReloadAt() {
  const store = getSessionStorageSafe();
  if (!store) return null;
  try {
    const parsed = parseInt(store.getItem(CHUNK_RELOAD_KEY) || '0', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return null;
  }
}

export function writeLastChunkReloadAt(timestampMs) {
  const store = getSessionStorageSafe();
  if (!store) return false;
  try {
    store.setItem(CHUNK_RELOAD_KEY, String(timestampMs));
    return true;
  } catch {
    return false;
  }
}

export function tryReserveChunkReload() {
  const lastReload = readLastChunkReloadAt();
  if (lastReload === null) {
    return false;
  }
  const now = Date.now();
  if (now - lastReload <= CHUNK_RELOAD_COOLDOWN_MS) {
    return false;
  }
  return writeLastChunkReloadAt(now);
}

export function clearChunkReloadGuards() {
  const store = getSessionStorageSafe();
  if (!store) return;
  for (const key of [CHUNK_RELOAD_KEY, 'auto_chunk_reload', 'retry-chunk-refresh']) {
    try {
      store.removeItem(key);
    } catch { }
  }
}

export async function clearBrowserCachesSafe() {
  try {
    if (typeof window !== 'undefined' && 'caches' in window && window.caches?.keys) {
      const names = await window.caches.keys();
      await Promise.all(names.map((name) => window.caches.delete(name)));
    }
  } catch { }
}
