// Shared chat attachments that are not files: an event/meeting invitation ("ewvon-event:<calendar_events.id>") and a
// location ("ewvon-loc:{json}") with a mini-map. Same message format on the PC and in the mobile app.
import { supabase } from '@/integrations/supabase/client';

/* ------------------------------------------------------------------ location */
export type ChatLoc = { lat: number; lng: number; name: string; addr: string; cap: string };
const LOC_RE = /^ewvon-loc:(\{.*\})$/s;
export const locContent = (l: ChatLoc) => `ewvon-loc:${JSON.stringify({ lat: +l.lat.toFixed(6), lng: +l.lng.toFixed(6), name: l.name.slice(0, 120), addr: l.addr.slice(0, 300), cap: l.cap.slice(0, 1000) })}`;
export function parseLoc(c: string | null | undefined): ChatLoc | null {
  const m = c ? LOC_RE.exec(c.trim()) : null;
  if (!m) return null;
  try {
    const j = JSON.parse(m[1]);
    const lat = Number(j.lat), lng = Number(j.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng, name: String(j.name || ''), addr: String(j.addr || ''), cap: String(j.cap || '') };
  } catch { return null; }
}

/** Address search (OpenStreetMap Nominatim, Portuguese, Brazil first). Only called on an explicit search. */
export async function searchPlaces(q: string): Promise<ChatLoc[]> {
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=6&accept-language=pt-BR&countrycodes=br&q=${encodeURIComponent(q.trim())}`;
  const r = await fetch(u, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('busca');
  const j = (await r.json()) as { lat: string; lon: string; name?: string; display_name: string }[];
  return j.map((x) => ({ lat: Number(x.lat), lng: Number(x.lon), name: x.name || x.display_name.split(',')[0], addr: x.display_name, cap: '' }));
}
export async function reversePlace(lat: number, lng: number): Promise<ChatLoc> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=pt-BR&lat=${lat}&lon=${lng}`, { headers: { Accept: 'application/json' } });
    const j = await r.json();
    return { lat, lng, name: j.name || (j.display_name || '').split(',')[0] || 'Localização', addr: j.display_name || '', cap: '' };
  } catch { return { lat, lng, name: 'Minha localização', addr: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, cap: '' }; }
}
export function myPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) { rej(new Error('Este aparelho não informa a localização.')); return; }
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => rej(new Error(e.code === 1 ? 'Permita o acesso à localização para usar esta opção.' : 'Não foi possível obter a sua localização.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}

export const mapLinks = (l: ChatLoc) => {
  const label = encodeURIComponent(l.name || l.addr || 'Local');
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`,
    waze: `https://waze.com/ul?ll=${l.lat},${l.lng}&navigate=yes`,
    geo: `geo:${l.lat},${l.lng}?q=${l.lat},${l.lng}(${label})`,
  };
};
export const isNativeApp = () => /EwvonApp\//.test(navigator.userAgent);

/** Map tiles (OpenStreetMap) for a w×h mini-map centred on the point; returns tiles with pixel offsets. */
export function mapTiles(lat: number, lng: number, z: number, w: number, h: number) {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  const px = x * 256 - w / 2, py = y * 256 - h / 2;
  const out: { src: string; left: number; top: number }[] = [];
  for (let tx = Math.floor(px / 256); tx <= Math.floor((px + w) / 256); tx++) {
    for (let ty = Math.floor(py / 256); ty <= Math.floor((py + h) / 256); ty++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n;
      out.push({ src: `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`, left: tx * 256 - px, top: ty * 256 - py });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ event */
const EV_RE = /^ewvon-event:([0-9a-f-]{36})$/;
export const eventContent = (id: string) => `ewvon-event:${id}`;
export const parseEvent = (c: string | null | undefined) => (c ? EV_RE.exec(c.trim())?.[1] ?? null : null);

export type EventDraft = {
  kind: 'meeting' | 'event'; title: string; date: string; start: string; end: string; allDay: boolean;
  where: 'local' | 'link' | 'call' | 'none'; place: string; link: string; description: string; reminder: number; participants: string[];
};
const pad = (n: number) => String(n).padStart(2, '0');
export function emptyEvent(kind: EventDraft['kind'] = 'meeting', participants: string[] = []): EventDraft {
  const d = new Date(Date.now() + 3600_000); d.setMinutes(0, 0, 0);
  const e = new Date(d.getTime() + 3600_000);
  return { kind, title: '', date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, start: `${pad(d.getHours())}:00`, end: `${pad(e.getHours())}:00`,
    allDay: false, where: kind === 'meeting' ? 'call' : 'local', place: '', link: '', description: '', reminder: 15, participants };
}
export function eventProblem(d: EventDraft): string | null {
  if (!d.title.trim()) return 'Dê um título.';
  if (!d.date) return 'Escolha a data.';
  if (!d.allDay && d.end && d.end <= d.start) return 'O fim precisa ser depois do início.';
  if (d.where === 'link' && !/^https:\/\/\S+$/i.test(d.link.trim())) return 'O link precisa começar com https://';
  return null;
}

/** Creates the calendar event + participants (they get the invitation like any other meeting). Returns its id. */
export async function createEvent(d: EventDraft): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('auth');
  const start = d.allDay ? new Date(`${d.date}T00:00:00`) : new Date(`${d.date}T${d.start}:00`);
  const end = d.allDay ? new Date(`${d.date}T23:59:59`) : d.end ? new Date(`${d.date}T${d.end}:00`) : null;
  const row: Record<string, unknown> = {
    title: d.title.trim().slice(0, 200), description: d.description.trim() || null, event_type: d.kind === 'meeting' ? 'meeting' : 'event',
    start_date: start.toISOString(), end_date: end ? end.toISOString() : null, all_day: d.allDay, color: d.kind === 'meeting' ? '#3b82f6' : '#8b5cf6',
    reminder_minutes: d.reminder || null, meeting_link: d.where === 'link' ? d.link.trim() : null, created_by: u.user.id,
  };
  if (d.where === 'local' && d.place.trim()) row.location = d.place.trim().slice(0, 300);
  if (d.where === 'call') row.video_room = 'ewvon';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from('calendar_events').insert(row).select('id').single();
  if (error) throw error;
  const id = data.id as string;
  const ppl = [...new Set(d.participants)];
  if (ppl.length) {
    const { error: pe } = await supabase.from('meeting_participants').insert(ppl.map((pid) => ({ event_id: id, profile_id: pid })));
    if (pe) console.warn('participants', pe.message);
  }
  return id;
}

/** Profiles of a conversation (sector:<id> / group:<id> / dm:<a>:<b>), used as the default invitees. */
export async function convMembers(convKey: string | null | undefined): Promise<string[]> {
  if (!convKey) return [];
  const [kind, a, b] = convKey.split(':');
  if (kind === 'dm') return [a, b].filter(Boolean);
  if (kind === 'group') {
    const { data } = await supabase.from('private_group_members').select('profile_id').eq('group_id', a);
    return (data || []).map((r: { profile_id: string }) => r.profile_id);
  }
  if (kind === 'sector' && a === '00000000-0000-0000-0000-000000000001') {   // general sector = everybody in the company
    const { data } = await supabase.from('profiles').select('id').eq('is_active', true).limit(1000);
    return (data || []).map((r: { id: string }) => r.id);
  }
  if (kind === 'sector') {
    const [p, x] = await Promise.all([
      supabase.from('profiles').select('id').eq('sector_id', a).eq('is_active', true).limit(500),
      supabase.from('user_additional_sectors').select('user_id').eq('sector_id', a).limit(500),
    ]);
    const uids = (x.data || []).map((r: { user_id: string }) => r.user_id);
    const extra = uids.length ? ((await supabase.from('profiles').select('id').in('user_id', uids).eq('is_active', true)).data || []) : [];
    return [...new Set([...(p.data || []), ...extra].map((r: { id: string }) => r.id))];
  }
  return [];
}

export const fmtEventWhen = (startIso: string, endIso: string | null, allDay: boolean) => {
  const s = new Date(startIso);
  const day = s.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '');
  if (allDay) return `${day} · dia todo`;
  const t = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${t(s)}${endIso ? `–${t(new Date(endIso))}` : ''}`;
};

/* ------------------------------------------------------------------ transit line (bus / train / metro / tram) */
export type TransitKind = 'bus' | 'train' | 'metro' | 'tram';
export type TransitStatus = 'normal' | 'delay' | 'down' | 'full';
export type ChatTransit = { k: TransitKind; line: string; name: string; from: string; to: string; city: string; color: string; st: TransitStatus; cap: string };
export const TRANSIT_KINDS: [TransitKind, string][] = [['bus', 'Ônibus'], ['train', 'Trem'], ['metro', 'Metrô'], ['tram', 'VLT / bonde']];
export const TRANSIT_STATUS: [TransitStatus, string][] = [['normal', 'Normal'], ['delay', 'Atrasos'], ['full', 'Lotado'], ['down', 'Interrompido']];
export const TRANSIT_COLORS = ['#e11d48', '#f59e0b', '#16a34a', '#2563eb', '#7c3aed', '#0891b2', '#475569', '#db2777'];
const TR_RE = /^ewvon-transit:(\{.*\})$/s;
export const emptyTransit = (): ChatTransit => ({ k: 'bus', line: '', name: '', from: '', to: '', city: '', color: TRANSIT_COLORS[3], st: 'normal', cap: '' });
export const transitContent = (x: ChatTransit) => `ewvon-transit:${JSON.stringify({ ...x, line: x.line.trim().slice(0, 12), name: x.name.trim().slice(0, 80), from: x.from.trim().slice(0, 80), to: x.to.trim().slice(0, 80), city: x.city.trim().slice(0, 60), cap: x.cap.trim().slice(0, 1000) })}`;
export function parseTransit(c: string | null | undefined): ChatTransit | null {
  const m = c ? TR_RE.exec(c.trim()) : null;
  if (!m) return null;
  try {
    const j = JSON.parse(m[1]);
    const k = (['bus', 'train', 'metro', 'tram'] as const).includes(j.k) ? j.k : 'bus';
    const st = (['normal', 'delay', 'down', 'full'] as const).includes(j.st) ? j.st : 'normal';
    const color = /^#[0-9a-f]{6}$/i.test(j.color) ? j.color : TRANSIT_COLORS[3];
    const s = (v: unknown) => String(v || '');
    if (!s(j.line) && !s(j.name)) return null;
    return { k, st, color, line: s(j.line), name: s(j.name), from: s(j.from), to: s(j.to), city: s(j.city), cap: s(j.cap) };
  } catch { return null; }
}
export const transitLabel = (x: ChatTransit) => `${TRANSIT_KINDS.find((k) => k[0] === x.k)?.[1] || 'Linha'} ${x.line || x.name}`.trim();
