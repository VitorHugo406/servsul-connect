import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type StorageTarget = { bucket: 'attachments' | 'avatars'; path: string };

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const pendingSignedUrls = new Map<string, Promise<string>>();
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const CACHE_SAFETY_MS = 60 * 1000;

// Storage signed URLs require database work. A large chat history can render
// many attachments at once, so cap concurrent signing requests to protect the
// shared Supabase connection pool.
const MAX_CONCURRENT_SIGNING_REQUESTS = 3;
let activeSigningRequests = 0;
const signingQueue: Array<() => void> = [];

async function withSigningLimit<T>(operation: () => Promise<T>): Promise<T> {
  if (activeSigningRequests >= MAX_CONCURRENT_SIGNING_REQUESTS) {
    await new Promise<void>((resolve) => signingQueue.push(resolve));
  }
  activeSigningRequests += 1;
  try {
    return await operation();
  } finally {
    activeSigningRequests -= 1;
    signingQueue.shift()?.();
  }
}

export function getStorageTarget(value?: string | null): StorageTarget | null {
  if (!value) return null;
  if (!value.includes('/storage/v1/object/')) return null;

  const match = value.match(/\/storage\/v1\/object\/(?:public|sign)\/(attachments|avatars)\/([^?]+)/);
  if (!match) return null;

  return {
    bucket: match[1] as StorageTarget['bucket'],
    path: decodeURIComponent(match[2]),
  };
}

export async function createSignedStorageUrl(value?: string | null): Promise<string> {
  const target = getStorageTarget(value);
  if (!value || !target) return value || '';

  const cacheKey = `${target.bucket}:${target.path}`;
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + CACHE_SAFETY_MS) return cached.url;

  // Reuse both cached results and in-flight work for identical files.
  const pending = pendingSignedUrls.get(cacheKey);
  if (pending) return pending;

  const request = withSigningLimit(async () => {
    const { data, error } = await supabase.storage
      .from(target.bucket)
      .createSignedUrl(target.path, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) return value;

    signedUrlCache.set(cacheKey, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    });

    return data.signedUrl;
  });

  pendingSignedUrls.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (pendingSignedUrls.get(cacheKey) === request) pendingSignedUrls.delete(cacheKey);
  }
}

export function useSignedStorageUrl(value?: string | null) {
  const targetKey = useMemo(() => {
    const target = getStorageTarget(value);
    return target ? `${target.bucket}:${target.path}` : value || '';
  }, [value]);
  const [signedUrl, setSignedUrl] = useState(value || '');

  useEffect(() => {
    let alive = true;
    setSignedUrl(value || '');

    if (!value || !getStorageTarget(value)) return;

    createSignedStorageUrl(value).then((url) => {
      if (alive) setSignedUrl(url);
    }).catch((error) => {
      console.error('Error signing storage URL:', error);
    });

    return () => { alive = false; };
  }, [value, targetKey]);

  return signedUrl;
}
