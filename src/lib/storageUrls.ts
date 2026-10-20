import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type StorageTarget = { bucket: 'attachments' | 'avatars'; path: string };

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const CACHE_SAFETY_MS = 60 * 1000;

export function getStorageTarget(value?: string | null): StorageTarget | null {
  if (!value) return null;
  if (!value.includes('/storage/v1/object/')) return null;

  const match = value.match(/\/storage\/v1\/object\/(?:public|sign)\/(attachments|avatars)\/([^?]+)/);
  if (!match) return null;

  try {
    return {
      bucket: match[1] as StorageTarget['bucket'],
      path: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

export async function createSignedStorageUrl(value?: string | null): Promise<string> {
  const target = getStorageTarget(value);
  if (!value || !target) return value || '';

  const cacheKey = `${target.bucket}:${target.path}`;
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + CACHE_SAFETY_MS) return cached.url;

  try {
    const { data, error } = await supabase.storage
      .from(target.bucket)
      .createSignedUrl(target.path, SIGNED_URL_TTL_SECONDS);

    // Fail closed: never fall back to an original public/object URL if signing fails.
    if (error || !data?.signedUrl) {
      signedUrlCache.delete(cacheKey);
      console.error('Unable to create a signed storage URL.');
      return '';
    }

    signedUrlCache.set(cacheKey, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    });

    return data.signedUrl;
  } catch (error) {
    signedUrlCache.delete(cacheKey);
    console.error('Unable to create a signed storage URL.', error);
    return '';
  }
}

export function useSignedStorageUrl(value?: string | null) {
  const targetKey = useMemo(() => {
    const target = getStorageTarget(value);
    return target ? `${target.bucket}:${target.path}` : value || '';
  }, [value]);
  const [signedUrl, setSignedUrl] = useState(() => {
    return getStorageTarget(value) ? '' : value || '';
  });

  useEffect(() => {
    let alive = true;
    const target = getStorageTarget(value);
    setSignedUrl(target ? '' : value || '');

    if (!value || !target) return;

    createSignedStorageUrl(value).then((url) => {
      if (alive) setSignedUrl(url);
    });

    return () => { alive = false; };
  }, [value, targetKey]);

  return signedUrl;
}