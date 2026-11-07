// End-to-end encrypted voice messages (WhatsApp-like). See
// supabase/migrations/20261108010000_e2e_voice.sql for the server side.
//
// - Each device keeps an ECDH P-256 key pair in IndexedDB. The private key is created
//   non-extractable, so it never leaves this browser/app; only the public key is published.
// - A voice note is encrypted with a fresh AES-256-GCM key. That key is sealed for every
//   device of every chat member (ECDH with an ephemeral key + AES-GCM) and stored per device.
// - The server only stores ciphertext and sealed keys: it cannot listen to the audio.
// - A device added after the message was sent cannot open it (same as WhatsApp).
import { supabase } from '@/integrations/supabase/client';
import { getActiveCompanyId } from '@/lib/companyScope';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;

// ---------------------------------------------------------------- message format
// 🎤 [0:12](voice:<company_id>/<user_id>/<uuid>.e2e)
const VOICE_RE = /^🎤 \[(\d{1,2}:\d{2})\]\(voice:([0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.e2e)\)$/;
export interface VoiceRef { duration: string; path: string }
export function parseVoice(content: string | null | undefined): VoiceRef | null {
  const m = String(content || '').trim().match(VOICE_RE);
  return m ? { duration: m[1], path: m[2] } : null;
}
export const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- base64 helpers
const b64 = (buf: ArrayBuffer | Uint8Array) => { const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// ---------------------------------------------------------------- device key (IndexedDB)
interface DeviceRec { deviceId: string; keys: CryptoKeyPair; pub: JsonWebKey }
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('ewvon-e2e', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('keys');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((res, rej) => { const q = db.transaction('keys').objectStore('keys').get(key); q.onsuccess = () => res(q.result as T); q.onerror = () => rej(q.error); });
}
async function idbPut(key: string, val: unknown) {
  const db = await idb();
  await new Promise<void>((res, rej) => { const t = db.transaction('keys', 'readwrite'); t.objectStore('keys').put(val, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}

let current: { profileId: string; dev: Promise<DeviceRec> } | null = null;

async function loadOrCreate(profileId: string): Promise<DeviceRec> {
  const k = `dev:${profileId}`;
  let rec = await idbGet<DeviceRec>(k);
  if (!rec) {
    const keys = await crypto.subtle.generateKey(ECDH, false, ['deriveKey']) as CryptoKeyPair;
    rec = { deviceId: crypto.randomUUID(), keys, pub: await crypto.subtle.exportKey('jwk', keys.publicKey) };
    await idbPut(k, rec);
  }
  const { error } = await sb.from('e2e_device_keys').upsert({ device_id: rec.deviceId, profile_id: profileId, public_key: rec.pub, company_id: getActiveCompanyId() || undefined, last_seen_at: new Date().toISOString() }, { onConflict: 'device_id' });
  if (error) console.warn('e2e: could not publish device key', error.message);
  return rec;
}

/** Creates (once) and publishes this device's key for the signed-in profile. */
export function initE2E(profileId: string) {
  if (!profileId || typeof indexedDB === 'undefined' || !crypto?.subtle) return;
  if (current?.profileId === profileId) return;
  current = { profileId, dev: loadOrCreate(profileId) };
  current.dev.catch((e) => { console.warn('e2e init', e); current = null; });
}
function device(): Promise<DeviceRec> {
  if (!current) throw new Error('Criptografia não iniciada neste aparelho');
  return current.dev;
}

// ---------------------------------------------------------------- send
/** Encrypts and uploads a voice note for the given chat members. Returns the message content. */
export async function sendVoice(audio: Blob, seconds: number, memberProfileIds: string[], meProfileId: string, chatKey?: string): Promise<string> {
  initE2E(meProfileId);
  await device();
  const companyId = getActiveCompanyId();
  const { data: auth } = await sb.auth.getUser();
  const uid = auth?.user?.id;
  if (!companyId || !uid) throw new Error('Sessão inválida');

  // Plaintext = [2-byte header length][header JSON][audio bytes]
  const header = new TextEncoder().encode(JSON.stringify({ mime: audio.type || 'audio/webm', s: Math.round(seconds) }));
  const body = new Uint8Array(2 + header.length + audio.size);
  body[0] = header.length >> 8; body[1] = header.length & 255;
  body.set(header, 2); body.set(new Uint8Array(await audio.arrayBuffer()), 2 + header.length);

  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, body));
  const file = new Blob([iv, ct], { type: 'application/octet-stream' });

  const path = `${companyId}/${uid}/${crypto.randomUUID()}.e2e`;
  const up = await sb.storage.from('voice').upload(path, file, { contentType: 'application/octet-stream', upsert: false });
  if (up.error) throw new Error('Não foi possível enviar o áudio');
  const reg = await sb.from('e2e_media').insert({ path, company_id: companyId, sender_profile_id: meProfileId, chat_key: chatKey || null });
  if (reg.error) throw new Error('Não foi possível registrar o áudio');

  // Seal the content key for every device of every member (including my other devices).
  const ids = [...new Set([...memberProfileIds, meProfileId])];
  const since = new Date(Date.now() - 120 * 864e5).toISOString();
  const devices: { device_id: string; public_key: JsonWebKey }[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await sb.from('e2e_device_keys').select('device_id, public_key').in('profile_id', ids.slice(i, i + 150)).gte('last_seen_at', since);
    devices.push(...(data || []));
  }
  const eph = await crypto.subtle.generateKey(ECDH, true, ['deriveKey']) as CryptoKeyPair;
  const epk = await crypto.subtle.exportKey('jwk', eph.publicKey);
  const rows = await Promise.all(devices.map(async (d) => {
    try {
      const pub = await crypto.subtle.importKey('jwk', d.public_key, ECDH, false, []);
      const kek = await crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, eph.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
      const wiv = crypto.getRandomValues(new Uint8Array(12));
      const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wiv }, kek, raw);
      return { media_path: path, device_id: d.device_id, epk, iv: b64(wiv), wrapped: b64(wrapped) };
    } catch { return null; }
  }));
  const ok = rows.filter(Boolean);
  for (let i = 0; i < ok.length; i += 200) {
    const r = await sb.from('e2e_media_keys').insert(ok.slice(i, i + 200));
    if (r.error) throw new Error('Não foi possível proteger o áudio');
  }
  raw.fill(0);
  return `🎤 [${fmtDuration(seconds)}](voice:${path})`;
}

// ---------------------------------------------------------------- receive
export class VoiceError extends Error { constructor(public code: 'nokey' | 'pending' | 'expired' | 'failed', msg: string) { super(msg); } }
const opened = new Map<string, Promise<string>>();

/** Downloads, decrypts and returns a local URL for the voice note (cached for this session). */
export function openVoice(path: string): Promise<string> {
  const known = opened.get(path);
  if (known) return known;
  const job = (async () => {
    const dev = await device();
    const { data: row } = await sb.from('e2e_media_keys').select('epk, iv, wrapped').eq('media_path', path).eq('device_id', dev.deviceId).maybeSingle();
    if (!row) {
      const { data: media } = await sb.from('e2e_media').select('path').eq('path', path).maybeSingle();
      if (!media) throw new VoiceError('expired', 'Áudio expirou');
      // Ask the sender's device to seal the key for this device (WhatsApp-like "waiting for this message").
      await sb.from('e2e_key_requests').upsert({ media_path: path, device_id: dev.deviceId, requester_profile_id: current?.profileId }, { onConflict: 'media_path,device_id', ignoreDuplicates: true });
      throw new VoiceError('pending', 'Aguardando a chave do aparelho de quem enviou');
    }
    const epk = await crypto.subtle.importKey('jwk', row.epk, ECDH, false, []);
    const kek = await crypto.subtle.deriveKey({ name: 'ECDH', public: epk }, dev.keys.privateKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(row.iv) }, kek, unb64(row.wrapped));
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const dl = await sb.storage.from('voice').download(path);
    if (dl.error || !dl.data) throw new VoiceError('expired', 'Áudio expirou');
    const all = new Uint8Array(await dl.data.arrayBuffer());
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12)));
    const hl = (plain[0] << 8) | plain[1];
    const header = JSON.parse(new TextDecoder().decode(plain.slice(2, 2 + hl))) as { mime: string };
    return URL.createObjectURL(new Blob([plain.slice(2 + hl)], { type: header.mime }));
  })();
  opened.set(path, job);
  job.catch(() => opened.delete(path));
  return job;
}

// ---------------------------------------------------------------- recording
export function pickAudioMime(): string {
  const options = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) || '';
}

// ---------------------------------------------------------------- key requests
/** Resolves when a sealed key for this device arrives for `path` (or after `ms`). */
export function waitForKey(path: string, ms = 120000): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    let ch: { unsubscribe?: () => void } | null = null;
    const finish = (v: boolean) => { if (done) return; done = true; window.clearTimeout(t); if (ch) void sb.removeChannel(ch); resolve(v); };
    const t = window.setTimeout(() => finish(false), ms);
    void device().then((dev) => {
      ch = sb.channel(`e2e-key-${dev.deviceId}-${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'e2e_media_keys', filter: `device_id=eq.${dev.deviceId}` }, (p: { new: { media_path?: string } }) => { if (p.new?.media_path === path) { opened.delete(path); finish(true); } })
        .subscribe();
    }).catch(() => finish(false));
  });
}

/**
 * Runs on the sender's device: seals the key of my voice notes for devices that asked for it,
 * only when the requester is one of my other devices or a member of that conversation.
 */
export async function processKeyRequests(meProfileId: string, isMember: (chatKey: string, profileId: string) => boolean) {
  const dev = await device();
  const { data: reqRows } = await sb.from('e2e_key_requests').select('media_path, device_id, requester_profile_id').limit(100);
  const paths = [...new Set(((reqRows || []) as { media_path: string }[]).map((r) => r.media_path))];
  if (!paths.length) return;
  const { data: media } = await sb.from('e2e_media').select('path, sender_profile_id, chat_key').in('path', paths);
  const M = new Map(((media || []) as { path: string; sender_profile_id: string; chat_key: string | null }[]).map((m) => [m.path, m]));
  const reqs = ((reqRows || []) as { media_path: string; device_id: string; requester_profile_id: string }[]).map((r) => ({ ...r, e2e_media: M.get(r.media_path) })).filter((r) => r.e2e_media);
  for (const r of reqs as { media_path: string; device_id: string; requester_profile_id: string; e2e_media: { sender_profile_id: string; chat_key: string | null } }[]) {
    if (r.e2e_media?.sender_profile_id !== meProfileId) continue;
    const allowed = r.requester_profile_id === meProfileId || (!!r.e2e_media.chat_key && isMember(r.e2e_media.chat_key, r.requester_profile_id));
    if (!allowed) { await sb.from('e2e_key_requests').delete().eq('media_path', r.media_path).eq('device_id', r.device_id); continue; }
    try {
      const { data: mine } = await sb.from('e2e_media_keys').select('epk, iv, wrapped').eq('media_path', r.media_path).eq('device_id', dev.deviceId).maybeSingle();
      if (!mine) continue; // another of my devices may answer
      const epk = await crypto.subtle.importKey('jwk', mine.epk, ECDH, false, []);
      const kek = await crypto.subtle.deriveKey({ name: 'ECDH', public: epk }, dev.keys.privateKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const raw = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(mine.iv) }, kek, unb64(mine.wrapped)));
      const { data: target } = await sb.from('e2e_device_keys').select('public_key').eq('device_id', r.device_id).maybeSingle();
      if (!target) continue;
      const pub = await crypto.subtle.importKey('jwk', target.public_key, ECDH, false, []);
      const eph = await crypto.subtle.generateKey(ECDH, true, ['deriveKey']) as CryptoKeyPair;
      const k2 = await crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, eph.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
      const wiv = crypto.getRandomValues(new Uint8Array(12));
      const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wiv }, k2, raw);
      raw.fill(0);
      await sb.from('e2e_media_keys').upsert({ media_path: r.media_path, device_id: r.device_id, epk: await crypto.subtle.exportKey('jwk', eph.publicKey), iv: b64(wiv), wrapped: b64(wrapped) }, { onConflict: 'media_path,device_id', ignoreDuplicates: true });
      await sb.from('e2e_key_requests').delete().eq('media_path', r.media_path).eq('device_id', r.device_id);
    } catch (e) { console.warn('e2e re-seal', e); }
  }
}

/** Listens for new key requests while the app is open. */
export function watchKeyRequests(meProfileId: string, isMember: (chatKey: string, profileId: string) => boolean) {
  let busy = false;
  const run = () => { if (busy) return; busy = true; void processKeyRequests(meProfileId, isMember).finally(() => { busy = false; }); };
  run();
  const ch = sb.channel(`e2e-req-${meProfileId}-${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'e2e_key_requests' }, run)
    .subscribe();
  return () => { void sb.removeChannel(ch); };
}
