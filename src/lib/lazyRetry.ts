// Lazy-loaded screens survive a new deploy: when a page file from the previous version no
// longer exists (the open tab still references old file names), reload once to get the new
// version instead of hanging on the loading screen. Guarded against reload loops.
import { lazy } from 'react';
import type { ComponentType } from 'react';

const KEY = 'ewvon:chunk-reload-at';

export function isChunkError(err: unknown) {
  const m = String((err as Error)?.message || err || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|ChunkLoadError|Unable to preload CSS/i.test(m);
}

/** Reloads the page once per minute at most; returns false when a reload already happened recently. */
export function reloadForNewVersion(): boolean {
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY) || 0); } catch { /* ignore */ }
  if (Date.now() - last < 60_000) return false;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
  window.location.reload();
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      // One quick retry (network hiccup), then a single reload for a new deploy.
      try { return await factory(); } catch { /* fall through */ }
      if (isChunkError(err) && reloadForNewVersion()) return await new Promise<{ default: T }>(() => {});
      throw err;
    }
  });
}
