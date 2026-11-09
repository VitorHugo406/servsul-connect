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

// ---------------------------------------------------------------- animated stickers
// Animated stickers (like WhatsApp, up to 5 s) are encoded as GIF so they play on every phone
// and browser. They live under the same content-addressed key (<sha>.webp) with the real type
// (image/gif) stored on the object: favorites, packs and messages need no change.
export const ANIM_MAX_SECONDS = 5;
const ANIM_MAX_BYTES = 1_400_000;

/** GIFs, animated WebP and short videos become animated stickers. */
export async function isAnimatedSource(file: Blob): Promise<boolean> {
  if (file.type.startsWith('video/') || file.type === 'image/gif') return true;
  if (file.type !== 'image/webp') return false;
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  return new TextDecoder().decode(head).includes('ANIM') || (head[20] & 0x02) === 0x02; // VP8X animation flag
}

/** Called once per captured frame, synchronously, while the source shows that frame. `draw` null = extend the previous frame. */
type FrameSink = (draw: ((ctx: CanvasRenderingContext2D, S: number) => void) | null, delayMs: number) => void;

function fit(ctx: CanvasRenderingContext2D, S: number, src: CanvasImageSource, w: number, h: number) {
  const pad = Math.round(S * 0.03), r = Math.min((S - pad * 2) / w, (S - pad * 2) / h);
  ctx.clearRect(0, 0, S, S);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, (S - w * r) / 2, (S - h * r) / 2, w * r, h * r);
}

async function videoFrames(file: Blob, fps: number, sink: FrameSink) {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  try {
    await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('Vídeo inválido')); window.setTimeout(() => rej(new Error('Vídeo demorou para abrir')), 15000); });
    const dur = Math.min(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : ANIM_MAX_SECONDS, ANIM_MAX_SECONDS);
    const n = Math.max(1, Math.floor(dur * fps));
    for (let i = 0; i < n; i++) {
      v.currentTime = Math.min(i / fps, Math.max(0, dur - 0.05));
      await new Promise<void>((res) => { const done = () => { v.removeEventListener('seeked', done); res(); }; v.addEventListener('seeked', done); window.setTimeout(done, 1500); });
      sink((ctx, S) => fit(ctx, S, v, v.videoWidth, v.videoHeight), 1000 / fps);
    }
  } finally { URL.revokeObjectURL(url); }
}

async function imageFrames(file: Blob, fps: number, sink: FrameSink): Promise<boolean> {
  // ImageDecoder decodes every GIF/WebP frame (Chrome, Edge, Android). Elsewhere: not animated.
  const ID = (window as unknown as { ImageDecoder?: new (o: { data: ArrayBuffer; type: string }) => { tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null }; decode(o: { frameIndex: number }): Promise<{ image: VideoFrame }>; close(): void } }).ImageDecoder;
  if (!ID) return false;
  const dec = new ID({ data: await file.arrayBuffer(), type: file.type });
  try {
    await dec.tracks.ready;
    const count = dec.tracks.selectedTrack?.frameCount || 1;
    if (count < 2) return false;
    const step = 1000 / fps;
    let t = 0, nextAt = 0;
    for (let i = 0; i < count && t < ANIM_MAX_SECONDS * 1000; i++) {
      const { image } = await dec.decode({ frameIndex: i });
      const d = Math.max(20, (image.duration ?? 100_000) / 1000);
      if (t >= nextAt) {
        // Merged (skipped) frames add their time to the previous one; delay of the current frame is set when the next arrives.
        sink((ctx, S) => fit(ctx, S, image, image.displayWidth, image.displayHeight), d);
        nextAt = t + step;
      } else sink(null, d);
      image.close();
      t += d;
    }
    return true;
  } finally { dec.close(); }
}

/** Encodes an animated sticker (GIF, transparent background, ≤ 5 s), shrinking until it fits. */
export async function makeAnimatedStickerBlob(file: Blob): Promise<Blob | null> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  for (const [S, fps] of [[320, 12], [256, 10], [200, 8]] as const) {
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Não foi possível criar a figurinha');
    // Frames are quantized as they are captured; each one is written once its duration is known.
    const gif = GIFEncoder();
    let prev: { index: Uint8Array; palette: number[][]; ti: number; delay: number } | null = null;
    const flush = () => { if (prev) gif.writeFrame(prev.index, S, S, { palette: prev.palette, delay: Math.round(prev.delay), transparent: prev.ti >= 0, transparentIndex: Math.max(0, prev.ti), dispose: 2 }); };
    let frames = 0;
    const sink: FrameSink = (draw, delay) => {
      if (!draw) { if (prev) prev.delay += delay; return; }
      draw(ctx, S);
      const data = ctx.getImageData(0, 0, S, S).data;
      const palette = quantize(data, 256, { format: 'rgba4444', oneBitAlpha: true });
      const index = applyPalette(data, palette, 'rgba4444');
      flush();
      prev = { index, palette, ti: palette.findIndex((p) => p[3] === 0), delay };
      frames++;
    };
    if (file.type.startsWith('video/')) await videoFrames(file, fps, sink);
    else if (!(await imageFrames(file, fps, sink))) return null;
    if (!frames) return null;
    flush();
    gif.finish();
    const blob = new Blob([gif.bytes()], { type: 'image/gif' });
    if (blob.size <= ANIM_MAX_BYTES) return blob;
  }
  throw new Error('Animação grande demais para figurinha. Use um trecho mais curto.');
}

/** Uploads (only if new) and returns the sticker. Same picture → same hash → same file. */
export async function createSticker(file: Blob): Promise<Sticker> {
  const companyId = getActiveCompanyId();
  if (!companyId) throw new Error('Empresa não identificada');
  const anim = (await isAnimatedSource(file)) ? await makeAnimatedStickerBlob(file) : null;
  if (!anim && file.type.startsWith('video/')) throw new Error('Não foi possível ler esse vídeo');
  const blob = anim || (await makeStickerBlob(file));
  const sha = await sha256(blob);
  const { error } = await sb.storage.from('stickers').upload(`${companyId}/${sha}.webp`, blob, { contentType: blob.type, upsert: false, cacheControl: '31536000' });
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
  if (content?.startsWith('📹 ewvon-call:')) return '📹 Chamada de vídeo';
  if (content?.startsWith('📞 ewvon-call:')) return '📞 Chamada de voz';
  const c = String(content || '').trim();
  if (!c) return '';
  if (isSticker(c)) return '✨ Figurinha';
  if (PACK_RE.test(c)) return '✨ Pacote de figurinhas';
  const voice = c.match(/^🎤 \[(\d{1,2}:\d{2})\]\(voice:/);
  if (voice) return `🎤 Áudio (${voice[1]})`;
  const lines = c.split('\n');
  const text = lines.filter((l) => !/^(📷|📎) \[.+?\]\(.+?\)$/.test(l) && !/^(📝|🏷️|⚡|📅|📌) /.test(l)).join(' ').replace(/^📋 Card #\d+ — /, '📋 ').replace(/\s+/g, ' ').trim();
  const imgs = lines.filter((l) => l.startsWith('📷 [')).length;
  const file = c.match(/^📎 \[(.+?)\]/m);
  const out = text || (imgs ? (imgs > 1 ? `📷 ${imgs} fotos` : '📷 Foto') : file ? `📎 ${file[1]}` : '');
  return out.length > max ? out.slice(0, max - 1).trimEnd() + '…' : out;
}

// ---------------------------------------------------------------- packs
export interface Pack { id: string; name: string; ownerId: string; items: Sticker[] }
const PACK_RE = /^✨ pack:([0-9a-f-]{36})$/;
export const packContent = (id: string) => `✨ pack:${id}`;
export const parsePack = (content: string | null | undefined) => String(content || '').trim().match(PACK_RE)?.[1] || null;

type PackRow = { id: string; name: string; owner_profile_id: string; company_id: string };
async function withItems(rows: PackRow[]): Promise<Pack[]> {
  if (!rows.length) return [];
  const { data } = await sb.from('chat_sticker_pack_items').select('pack_id, sha256, position, added_at').in('pack_id', rows.map((r) => r.id)).order('position').order('added_at');
  return rows.map((r) => ({ id: r.id, name: r.name, ownerId: r.owner_profile_id, items: ((data || []) as { pack_id: string; sha256: string }[]).filter((i) => i.pack_id === r.id).map((i) => ({ kind: 'img', companyId: r.company_id, sha: i.sha256 }) as Sticker) }));
}
export async function listMyPacks(meId: string): Promise<Pack[]> {
  const { data } = await sb.from('chat_sticker_packs').select('id, name, owner_profile_id, company_id').eq('owner_profile_id', meId).order('created_at');
  return withItems((data || []) as PackRow[]);
}
export async function getPack(id: string): Promise<Pack | null> {
  const { data } = await sb.from('chat_sticker_packs').select('id, name, owner_profile_id, company_id').eq('id', id).maybeSingle();
  return data ? (await withItems([data as PackRow]))[0] : null;
}
export async function createPack(name: string, meId: string): Promise<Pack> {
  const { data, error } = await sb.from('chat_sticker_packs').insert({ name: name.trim().slice(0, 40), owner_profile_id: meId, company_id: getActiveCompanyId() || undefined }).select('id, name, owner_profile_id, company_id').single();
  if (error || !data) throw new Error('Não foi possível criar o pacote');
  return { id: data.id, name: data.name, ownerId: data.owner_profile_id, items: [] };
}
export async function renamePack(id: string, name: string) { await sb.from('chat_sticker_packs').update({ name: name.trim().slice(0, 40), updated_at: new Date().toISOString() }).eq('id', id); }
export async function deletePack(id: string) { const { error } = await sb.from('chat_sticker_packs').delete().eq('id', id); if (error) throw new Error('Não foi possível excluir o pacote'); }
export async function addToPack(packId: string, stickers: Sticker[]) {
  const rows = stickers.filter((s): s is Extract<Sticker, { kind: 'img' }> => s.kind === 'img').map((s, i) => ({ pack_id: packId, sha256: s.sha, position: Date.now() % 1e6 + i }));
  if (!rows.length) return;
  const { error } = await sb.from('chat_sticker_pack_items').upsert(rows, { onConflict: 'pack_id,sha256', ignoreDuplicates: true });
  if (error) throw new Error('Não foi possível adicionar ao pacote');
}
export async function removeFromPack(packId: string, sha: string) { await sb.from('chat_sticker_pack_items').delete().eq('pack_id', packId).eq('sha256', sha); }
/** Adds a copy of someone's pack to my packs (and its stickers to my favorites). */
export async function copyPack(pack: Pack, meId: string): Promise<Pack> {
  const mine = await createPack(pack.name, meId);
  await addToPack(mine.id, pack.items);
  await Promise.all(pack.items.map((s) => addFavorite(s).catch(() => undefined)));
  return { ...mine, items: pack.items };
}

// ---------------------------------------------------------------- export / import (.ewvonpack)
const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
export async function exportPack(pack: Pack): Promise<File> {
  const stickers: string[] = [];
  for (const s of pack.items) {
    if (s.kind !== 'img') continue;
    const { data } = await sb.storage.from('stickers').download(`${s.companyId}/${s.sha}.webp`);
    if (data) stickers.push(await toDataUrl(data));
  }
  const body = JSON.stringify({ format: 'ewvon-stickers', version: 1, name: pack.name, stickers });
  const safe = pack.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'figurinhas';
  return new File([body], `${safe}.ewvonpack`, { type: 'application/json' });
}
/** Shares the pack file with the phone's share sheet (WhatsApp, e-mail…) or downloads it. */
export async function shareOrDownload(file: File): Promise<'shared' | 'downloaded'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: file.name }); return 'shared'; } catch { /* cancelled: fall back to download */ }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
export async function importPack(file: File, meId: string): Promise<Pack> {
  if (file.size > 15_000_000) throw new Error('Arquivo grande demais');
  let data: { format?: string; name?: string; stickers?: string[] };
  try { data = JSON.parse(await file.text()); } catch { throw new Error('Arquivo de pacote inválido'); }
  if (data.format !== 'ewvon-stickers' || !Array.isArray(data.stickers)) throw new Error('Arquivo de pacote inválido');
  const created: Sticker[] = [];
  for (const d of data.stickers.slice(0, 120)) {
    if (typeof d !== 'string' || !/^data:image\/(webp|png|gif);base64,/.test(d)) continue;
    const blob = await (await fetch(d)).blob();
    created.push(await createSticker(blob));
  }
  if (!created.length) throw new Error('O pacote não tem figurinhas válidas');
  const pack = await createPack(String(data.name || 'Pacote importado'), meId);
  await addToPack(pack.id, created);
  return { ...pack, items: created };
}
