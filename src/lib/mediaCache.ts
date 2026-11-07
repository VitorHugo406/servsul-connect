// Device copy of chat media (WhatsApp-like). Photos and files from the private
// attachments bucket are downloaded once and kept in the browser/app Cache
// Storage, so they keep working on this device after the server copy expires
// (chat media retention, see register_chat_media).
import { useEffect, useState } from 'react';
import { createSignedStorageUrl, getStorageTarget } from '@/lib/storageUrls';
import { supabase } from '@/integrations/supabase/client';

const CACHE = 'ewwon-media-v1';
const keyOf = (bucket: string, path: string) => `https://media.ewwon.local/${bucket}/${path}`;
const objectUrls = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

const canCache = () => typeof caches !== 'undefined';

async function fromCache(key: string): Promise<Blob | null> {
  if (!canCache()) return null;
  try {
    const c = await caches.open(CACHE);
    const r = await c.match(key);
    return r ? await r.blob() : null;
  } catch {
    return null;
  }
}

/**
 * Returns a local object URL for the media (cached copy first, then download
 * and cache). Returns null when the server copy expired and this device never
 * saved it.
 */
export function loadMedia(url: string): Promise<string | null> {
  const target = getStorageTarget(url);
  if (!target) return Promise.resolve(url || null);
  const key = keyOf(target.bucket, target.path);
  const known = objectUrls.get(key);
  if (known) return Promise.resolve(known);
  const running = inflight.get(key);
  if (running) return running;
  const job = (async () => {
    const cached = await fromCache(key);
    if (cached) {
      const u = URL.createObjectURL(cached);
      objectUrls.set(key, u);
      return u;
    }
    try {
      const signed = await createSignedStorageUrl(url);
      if (!signed) return null;
      const res = await fetch(signed);
      if (!res.ok) return null;
      const blob = await res.blob();
      if (canCache()) {
        try {
          const c = await caches.open(CACHE);
          await c.put(key, new Response(blob, { headers: { 'Content-Type': blob.type || 'application/octet-stream' } }));
        } catch { /* quota exceeded: still show the media */ }
      }
      // Tell the server this device has its copy: when every recipient has one,
      // the server copy is removed (WhatsApp-like). Only chat media is tracked.
      if (target.bucket === 'attachments' && target.path.split('/')[1] === 'chat') {
        void Promise.resolve((supabase as unknown as { rpc: (n: string, a: Record<string, string>) => PromiseLike<unknown> }).rpc('ack_chat_media', { _path: target.path })).catch(() => undefined);
      }
      const u = URL.createObjectURL(blob);
      objectUrls.set(key, u);
      return u;
    } catch {
      return null;
    }
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

export function useCachedMedia(url: string | null | undefined, enabled = true): { src: string | null; state: 'loading' | 'ready' | 'expired' } {
  const [st, setSt] = useState<{ src: string | null; state: 'loading' | 'ready' | 'expired' }>({ src: null, state: 'loading' });
  useEffect(() => {
    if (!url || !enabled) return;
    let alive = true;
    setSt({ src: null, state: 'loading' });
    void loadMedia(url).then((u) => { if (alive) setSt(u ? { src: u, state: 'ready' } : { src: null, state: 'expired' }); });
    return () => { alive = false; };
  }, [url, enabled]);
  return st;
}

/** Opens a file (downloading and caching it on first use). */
export async function openMedia(url: string, name: string): Promise<boolean> {
  const u = await loadMedia(url);
  if (!u) return false;
  const a = document.createElement('a');
  a.href = u;
  a.target = '_blank';
  a.rel = 'noopener';
  if (!/\.(pdf|png|jpe?g|gif|webp|txt)$/i.test(name)) a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

/** Saves the media to the device's downloads ("Salvar no aparelho"). */
export async function saveMedia(url: string, name: string): Promise<boolean> {
  const u = await loadMedia(url);
  if (!u) return false;
  const a = document.createElement('a');
  a.href = u;
  a.download = name || 'arquivo';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
