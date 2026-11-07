// Chat stickers (WhatsApp-like), shared by the desktop chat and the mobile app.
// - A sticker message is one line: "✨ sticker:<company_id>/<sha256>" (image sticker)
//   or "✨ sticker:e:<emoji>" (built-in emoji sticker, no file at all).
// - Image stickers are 512x512 WebP, stored once per company in the private
//   "stickers" bucket as <company_id>/<sha256>.webp. The name is the hash of the
//   bytes, so sending the same sticker again never uploads it again, and devices
//   keep their own cached copy (see mediaCache).
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { getActiveCompanyId } from '@/lib/companyScope';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
const PREFIX = '✨ sticker:';
const RE = /^✨ sticker:(?:e:(.{1,16})|([0-9a-f-]{36})\/([0-9a-f]{64}))$/u;

export type Sticker = { kind: 'emoji'; emoji: string } | { kind: 'img'; companyId: string; sha: string };

export const EMOJI_STICKERS = ['😂', '😍', '🥳', '👍', '🙏', '🔥', '😎', '😭', '🤔', '👏', '❤️', '😅', '🤝', '💪', '🎉', '😴', '🤯', '🙌', '✅', '☕', '🚀', '😬', '🫡', '👀'];

export function parseSticker(content: string | null | undefined): Sticker | null {
  const m = String(content || '').trim().match(RE);
  if (!m) return null;
  return m[1] ? { kind: 'emoji', emoji: m[1] } : { kind: 'img', companyId: m[2], sha: m[3] };
}
export const isSticker = (content: string | null | undefined) => !!parseSticker(content);
export const stickerContent = (s: Sticker) => (s.kind === 'emoji' ? `${PREFIX}e:${s.emoji}` : `${PREFIX}${s.companyId}/${s.sha}`);
export const stickerKey = (s: Sticker) => (s.kind === 'emoji' ? 'e:' + s.emoji : s.sha);
/** URL understood by storageUrls/mediaCache (signed on demand, cached on the device). */
export const stickerUrl = (companyId: string, sha: string) => `${SUPABASE_URL}/storage/v1/object/sign/stickers/${companyId}/${sha}.webp`;

// ---------------------------------------------------------------- making a sticker

async function sha256(blob: Blob) {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Imagem inválida')); };
    img.src = url;
  });
}

/** Turns any picture into a 512x512 WebP sticker (fit inside, transparent background), like WhatsApp. */
export async function makeStickerBlob(file: Blob): Promise<Blob> {
  const img = await loadImage(file);
  const S = 512, pad = 16;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Não foi possível criar a figurinha');
  const r = Math.min((S - pad * 2) / img.width, (S - pad * 2) / img.height);
  const w = img.width * r, h = img.height * r;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    const b: Blob | null = await new Promise((res) => c.toBlob(res, 'image/webp', q));
    if (!b || b.type !== 'image/webp') throw new Error('Seu navegador não gera figurinhas WebP');
    if (b.size <= 280_000 || q === 0.4) return b;
  }
  throw new Error('Figurinha grande demais');
}

/** Uploads (only if new) and returns the sticker. Same picture → same hash → same file. */
export async function createSticker(file: Blob): Promise<Sticker> {
  const companyId = getActiveCompanyId();
  if (!companyId) throw new Error('Empresa não identificada');
  const blob = await makeStickerBlob(file);
  const sha = await sha256(blob);
  const { error } = await sb.storage.from('stickers').upload(`${companyId}/${sha}.webp`, blob, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
  if (error && !/exist|duplicate|409/i.test(`${error.message} ${error.statusCode ?? ''}`)) throw new Error('Não foi possível salvar a figurinha');
  const s: Sticker = { kind: 'img', companyId, sha };
  await addFavorite(s).catch(() => undefined);
  return s;
}

// ---------------------------------------------------------------- my stickers / recents

export async function listFavorites(): Promise<Sticker[]> {
  const companyId = getActiveCompanyId();
  if (!companyId) return [];
  const { data, error } = await sb.from('chat_sticker_favorites').select('sha256, company_id, created_at').order('created_at', { ascending: false }).limit(200);
  if (error) return [];
  return (data || []).map((r: { sha256: string; company_id: string }) => ({ kind: 'img', companyId: r.company_id, sha: r.sha256 }) as Sticker);
}
export async function addFavorite(s: Sticker) {
  if (s.kind !== 'img') return;
  const { error } = await sb.from('chat_sticker_favorites').upsert({ sha256: s.sha, company_id: s.companyId }, { onConflict: 'profile_id,sha256', ignoreDuplicates: true });
  if (error) throw error;
}
export async function removeFavorite(s: Sticker) {
  if (s.kind !== 'img') return;
  await sb.from('chat_sticker_favorites').delete().eq('sha256', s.sha);
}

const RECENT_KEY = 'ewvon:stickers:recent';
export function recentStickers(): Sticker[] {
  try { return (JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[]).map(parseSticker).filter(Boolean) as Sticker[]; } catch { return []; }
}
export function pushRecent(s: Sticker) {
  try {
    const list = [stickerContent(s), ...(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[]).filter((x) => x !== stickerContent(s))].slice(0, 24);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* storage unavailable */ }
}

/** One-line chat preview shared by every conversation list (desktop and mobile). */
export function chatPreview(content: string | null | undefined, max = 60): string {
  const c = String(content || '').trim();
  if (!c) return '';
  if (isSticker(c)) return '✨ Figurinha';
  const voice = c.match(/^🎤 \[(\d{1,2}:\d{2})\]\(voice:/);
  if (voice) return `🎤 Áudio (${voice[1]})`;
  const lines = c.split('\n');
  const text = lines.filter((l) => !/^(📷|📎) \[.+?\]\(.+?\)$/.test(l) && !/^(📝|🏷️|⚡|📅|📌) /.test(l)).join(' ').replace(/^📋 Card #\d+ — /, '📋 ').replace(/\s+/g, ' ').trim();
  const imgs = lines.filter((l) => l.startsWith('📷 [')).length;
  const file = c.match(/^📎 \[(.+?)\]/m);
  const out = text || (imgs ? (imgs > 1 ? `📷 ${imgs} fotos` : '📷 Foto') : file ? `📎 ${file[1]}` : '');
  return out.length > max ? out.slice(0, max - 1).trimEnd() + '…' : out;
}
