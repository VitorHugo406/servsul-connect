// Fotos e vídeos dos avisos (migration 20261123010000): bucket PRIVADO announcement-media, caminho
// <empresa>/<aviso>/<arquivo>, um registro em announcement_media por arquivo. Quem vê o aviso vê a mídia (links
// assinados de 1 hora); quando o aviso expira ou é excluído, a limpeza agendada apaga os arquivos e os registros.
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const BUCKET = 'announcement-media';
export const MEDIA_MAX_FILES = 6;
export const IMAGE_MAX = 10 * 1024 * 1024;
export const VIDEO_MAX = 50 * 1024 * 1024;
/** Kinds stored as they are; other photos (HEIC, BMP…) are converted to JPEG before sending. */
const OK = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp', 'video/x-m4v']);
const EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp', mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp' };
/** The Android app's file chooser only honours the FIRST accepted type (a list would show only JPEGs and hide
 *  videos), so inside the app nothing is filtered and the file is checked after it is picked. */
export function mediaAccept(): string | undefined {
  return typeof window !== 'undefined' && (window as unknown as { EwvonNative?: unknown }).EwvonNative ? undefined : 'image/*,video/*';
}
/** Real type of a picked file: some phones send it empty or generic, so the extension decides. */
export function mediaType(f: File): string {
  const t = (f.type || '').toLowerCase();
  if (t && t !== 'application/octet-stream') return t === 'image/jpg' ? 'image/jpeg' : t;
  return EXT[(f.name.split('.').pop() || '').toLowerCase()] || '';
}

export type AnnMedia = { id: string; announcement_id: string; path: string; kind: 'image' | 'video'; mime: string | null; size: number | null; position: number; url: string };

/** Problem with a file, in plain Portuguese (null = it can be sent). */
export function mediaProblem(f: File): string | null {
  const t = mediaType(f);
  if (!t.startsWith('image/') && !t.startsWith('video/')) return `"${f.name}" não é foto nem vídeo.`;
  if (t.startsWith('video/') && !OK.has(t)) return `"${f.name}": envie o vídeo em MP4, MOV ou WebM.`;
  const video = t.startsWith('video/');
  if (f.size > (video ? VIDEO_MAX : IMAGE_MAX)) return `"${f.name}" passa de ${video ? '50' : '10'} MB.`;
  return null;
}

/** Big photos are reduced (max 2000 px, JPEG) so the storage is not filled by phone pictures; GIFs stay as they are. */
async function shrink(f: File): Promise<Blob> {
  const t = mediaType(f);
  if (!t.startsWith('image/') || t === 'image/gif') return t && t !== f.type ? new Blob([f], { type: t }) : f;
  const convert = !OK.has(t);   // HEIC, BMP…: re-encode as JPEG so every browser shows it
  if (!convert && f.size < 1.5 * 1024 * 1024) return t !== f.type ? new Blob([f], { type: t }) : f;
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height);
    const out: Blob | null = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
    if (out && (convert || out.size < f.size)) return out;
    return t !== f.type ? new Blob([f], { type: t }) : f;
  } catch { if (convert) throw new Error('decode'); return f; }
}

/** Sends the files of an announcement (after it was created, because the path needs its id). Returns how many failed. */
export async function uploadAnnouncementMedia(companyId: string, announcementId: string, files: File[], startPos = 0): Promise<number> {
  let failed = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (mediaProblem(f)) { failed++; continue; }
    let blob: Blob;
    try { blob = await shrink(f); } catch { failed++; continue; }
    const type = blob.type || mediaType(f);
    const ext = type === 'image/jpeg' ? 'jpg' : (type.split('/')[1] || 'bin').replace('quicktime', 'mov');
    const path = `${companyId}/${announcementId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, cacheControl: '3600', upsert: false });
    if (up.error) { failed++; continue; }
    const { error } = await db.from('announcement_media').insert({ announcement_id: announcementId, company_id: companyId, path, kind: type.startsWith('video/') ? 'video' : 'image', mime: type, size: blob.size, position: startPos + i });
    if (error) { failed++; await supabase.storage.from(BUCKET).remove([path]); }
  }
  return failed;
}

/** Media of several announcements with signed links (1 h), grouped by announcement id. */
export async function listAnnouncementMedia(ids: string[]): Promise<Map<string, AnnMedia[]>> {
  const out = new Map<string, AnnMedia[]>();
  if (!ids.length) return out;
  const { data, error } = await db.from('announcement_media').select('id,announcement_id,path,kind,mime,size,position').in('announcement_id', ids).order('position');
  if (error || !data?.length) return out;
  const rows = data as Omit<AnnMedia, 'url'>[];
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.path), 3600);
  const urls = new Map((signed || []).map((s) => [s.path, s.signedUrl]));
  for (const r of rows) {
    const url = urls.get(r.path); if (!url) continue;
    const list = out.get(r.announcement_id) || []; list.push({ ...r, url }); out.set(r.announcement_id, list);
  }
  return out;
}

export async function removeAnnouncementMedia(m: Pick<AnnMedia, 'id' | 'path'>): Promise<boolean> {
  const { error } = await db.from('announcement_media').delete().eq('id', m.id);
  if (error) return false;
  await supabase.storage.from(BUCKET).remove([m.path]);
  return true;
}
