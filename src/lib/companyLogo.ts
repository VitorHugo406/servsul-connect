import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'company-logos';
const TTL_SECONDS = 60 * 60 * 8;
const SAFETY_MS = 60 * 1000;

const signedCache = new Map<string, { url: string; expiresAt: number }>();
const pending = new Map<string, Promise<string | null>>();

/** Extrai o caminho dentro do bucket a partir do valor salvo em companies.logo_url. */
export function getCompanyLogoPathFromValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (/^(data:|blob:)/i.test(normalized)) return null;

  const match = normalized.match(/\/storage\/v1\/object\/(?:public|sign)\/company-logos\/([^?]+)/);
  if (match) return decodeURIComponent(match[1]);
  if (/^https?:/i.test(normalized)) return null;

  return normalized.replace(/^\/+/, '').replace(new RegExp(`^${BUCKET}/`), '').split('?')[0];
}

export async function createCompanyLogoUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(data:|blob:)/i.test(trimmed)) return trimmed;

  const path = getCompanyLogoPathFromValue(trimmed);
  if (!path) return /^https?:/i.test(trimmed) ? trimmed : null;

  const cached = signedCache.get(path);
  if (cached && cached.expiresAt > Date.now() + SAFETY_MS) return cached.url;

  let promise = pending.get(path);
  if (!promise) {
    promise = supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, TTL_SECONDS)
      .then(({ data, error }) => {
        if (error || !data?.signedUrl) return null;
        signedCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + TTL_SECONDS * 1000 });
        return data.signedUrl;
      })
      .finally(() => { pending.delete(path); });
    pending.set(path, promise);
  }
  return promise;
}

/** Versão síncrona (cache). Dispara a assinatura em background quando ainda não houver cache. */
export function getCompanyLogoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(data:|blob:)/i.test(trimmed)) return trimmed;

  const path = getCompanyLogoPathFromValue(trimmed);
  if (!path) return /^https?:/i.test(trimmed) ? trimmed : null;

  const cached = signedCache.get(path);
  if (cached && cached.expiresAt > Date.now() + SAFETY_MS) return cached.url;
  void createCompanyLogoUrl(trimmed);
  return null;
}

export function useCompanyLogoUrl(value: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => getCompanyLogoUrl(value));

  useEffect(() => {
    let alive = true;
    setUrl(getCompanyLogoUrl(value));
    void createCompanyLogoUrl(value).then(resolved => { if (alive) setUrl(resolved); });
    return () => { alive = false; };
  }, [value]);

  return url;
}

export function getCompanyLogoPath(slug: string, file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  return `${slug}/logo-${Date.now()}.${extension}`;
}

/** Puts the company logo in the browser tab with rounded corners (white tile, logo fitted inside, 22% radius). */
export function setRoundedFavicon(url: string | null | undefined): void {
  const links = () => document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]');
  if (!url) return;
  const img = new Image();
  if (/^https?:/i.test(url)) img.crossOrigin = 'anonymous';
  img.onload = () => {
    let href = url;
    try {
      const s = 64, r = Math.round(s * 0.22), c = document.createElement('canvas'); c.width = s; c.height = s;
      const g = c.getContext('2d');
      if (g) {
        g.beginPath(); g.moveTo(r, 0); g.arcTo(s, 0, s, s, r); g.arcTo(s, s, 0, s, r); g.arcTo(0, s, 0, 0, r); g.arcTo(0, 0, s, 0, r); g.closePath(); g.clip();
        g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
        const w = img.naturalWidth || s, h = img.naturalHeight || s, k = Math.min(s / w, s / h), dw = w * k, dh = h * k;
        g.drawImage(img, (s - dw) / 2, (s - dh) / 2, dw, dh);
        href = c.toDataURL('image/png');
      }
    } catch { /* image without CORS: keep the plain logo */ }
    links().forEach((l) => { l.href = href; });
  };
  img.onerror = () => links().forEach((l) => { l.href = url; });
  img.src = url;
}
