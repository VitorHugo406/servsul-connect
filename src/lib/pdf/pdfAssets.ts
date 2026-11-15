// Browser-only helpers that turn logos and photos into data URLs for the PDF generators.
import type { Img } from './pdfKit';
import { createCompanyLogoUrl } from '@/lib/companyLogo';

const readBlob = (blob: Blob) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onloadend = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(blob); });
const loadElement = (src: string) => new Promise<HTMLImageElement | null>((resolve) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = src; });

/** Any image URL → PNG data URL with its pixel size (null if it cannot be loaded). */
export async function imageFromUrl(src: string | null | undefined, maxSide = 900): Promise<Img | null> {
  if (!src) return null;
  try {
    const data = /^data:/i.test(src) ? src : await readBlob(await (await fetch(src)).blob());
    const el = await loadElement(data);
    if (!el) return null;
    const s = Math.min(1, maxSide / Math.max(el.width, el.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(el.width * s)); c.height = Math.max(1, Math.round(el.height * s));
    const ctx = c.getContext('2d'); if (!ctx) return null;
    ctx.drawImage(el, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/png'), w: c.width, h: c.height };
  } catch { return null; }
}

export async function companyLogoImage(logoValue: string | null | undefined): Promise<Img | null> {
  if (!logoValue) return null;
  try { return await imageFromUrl(await createCompanyLogoUrl(logoValue)); } catch { return null; }
}

let ewvonCache: Promise<Img | null> | null = null;
/** White ewvon logo (used on the black capsules). */
export const ewvonLogoImage = () => (ewvonCache ??= imageFromUrl('/ewwon/img/logo-full.png', 600));

/** Square, circular photo (for the birthday cards). */
export async function circularPhoto(src: string | null | undefined, size = 240): Promise<Img | null> {
  if (!src) return null;
  try {
    const data = /^data:/i.test(src) ? src : await readBlob(await (await fetch(src)).blob());
    const el = await loadElement(data); if (!el) return null;
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const ctx = c.getContext('2d'); if (!ctx) return null;
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    const s = Math.max(size / el.width, size / el.height), w = el.width * s, h = el.height * s;
    ctx.drawImage(el, (size - w) / 2, Math.min(0, (size - h) / 3), w, h);
    return { data: c.toDataURL('image/png'), w: size, h: size };
  } catch { return null; }
}
