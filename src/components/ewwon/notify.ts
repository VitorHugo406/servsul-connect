// Notifications and native bridge for the Ewwon mobile app.
// Ported from the prototype's notifications.js / native.js. Inside the Android
// (Capacitor) shell it uses the Capacitor plugins exposed on window.Capacitor;
// in the browser it falls back to the Notification API, sounds and vibration.
import type { Chat, Person, Prefs } from './data';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any;

const cap = (): AnyObj => (typeof window !== 'undefined' ? (window as AnyObj).Capacitor : null);
export const isNative = () => !!(cap()?.isNativePlatform && cap().isNativePlatform());
const plug = (n: string): AnyObj => (isNative() && cap()?.Plugins ? cap().Plugins[n] : null);

export const CHANNELS = [
  { id: 'mensagens', name: 'Mensagens', description: 'Novas mensagens de conversas e grupos', importance: 5, visibility: 0, sound: 'ewwon_msg.wav', vibration: true, lights: true, lightColor: '#FFFFFF' },
  { id: 'avisos', name: 'Avisos da administração', description: 'Comunicados enviados pelo administrador', importance: 5, visibility: 1, sound: 'ewwon_aviso.wav', vibration: true, lights: true, lightColor: '#FF5D5D' },
  { id: 'reunioes', name: 'Reuniões e lembretes', description: 'Lembretes antes das reuniões', importance: 4, visibility: 0, sound: 'ewwon_msg.wav', vibration: true },
  { id: 'aniversarios', name: 'Aniversários', description: 'Aniversariantes do dia', importance: 3, visibility: 1, vibration: false },
  { id: 'silencioso', name: 'Silenciosas', description: 'Sem som e sem vibração', importance: 2, visibility: 0, vibration: false },
];
const CH_OF: Record<string, string> = { message: 'mensagens', notice: 'avisos', meeting: 'reunioes', birthday: 'aniversarios' };

export type NotifyType = 'message' | 'notice' | 'meeting' | 'birthday';
export interface NotifyEvent { type: NotifyType; chat?: Chat | null; urgent?: boolean; mention?: boolean; title: string; body: string; data?: Record<string, string>; id?: number }

interface Ctx { prefs: () => Prefs; me: () => Person | null; open: (d: Record<string, string>) => void; chat: (id: string) => Chat | null; banner: (o: { title: string; body: string; data: Record<string, string> }) => void; onToken?: (t: string) => void; savePush?: (s: { endpoint: string; p256dh: string; auth: string }) => Promise<void> }
let ctx: Ctx = { prefs: () => ({}), me: () => null, open: () => undefined, chat: () => null, banner: () => undefined };
let fg = typeof document === 'undefined' ? true : !document.hidden;
let perm: 'granted' | 'denied' | 'prompt' | 'unknown' = 'unknown';

const hash = (s: string) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 2147483000; };
const hm2min = (s: string) => { const a = String(s || '0:0').split(':'); return +a[0] * 60 + (+a[1] || 0); };

const fold = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** True when the text has "@<name>" for any of the given names (accents and case ignored). */
export function mentionsName(text: string, names: (string | null | undefined)[]) {
  const t = fold(String(text || ''));
  return names.some((n) => { const v = fold(String(n || '').trim()); return v.length > 1 && new RegExp(`(^|[^\\w@])@${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`).test(t); });
}

export function isChatMuted(chat?: Chat | null) {
  const s = chat?.set;
  if (!s || !s.mute) return false;
  return !s.muteUntil || s.muteUntil > Date.now();
}

export function withinWorkHours(me: Person | null, d = new Date()) {
  if (!me) return true;
  const idx = (d.getDay() + 6) % 7;
  if (me.days && !me.days[idx]) return false;
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= hm2min(me.h[0]) && m <= hm2min(me.h[1]);
}

export function shouldNotify(evt: NotifyEvent): { allow: boolean; reason?: string } {
  const p = ctx.prefs() || {};
  const me = ctx.me();
  // Being @mentioned always notifies, even with message notifications off, the chat muted or "não incomodar".
  if (evt.type === 'message' && evt.mention) return { allow: true };
  if (evt.type === 'message') {
    const c = evt.chat;
    if (p.nm === 0) return { allow: false, reason: 'mensagens desativadas' };
    if (c && c.g ? p.ngrp === 0 : p.ndm === 0) return { allow: false, reason: c && c.g ? 'grupos desativados' : 'individuais desativadas' };
    if (isChatMuted(c)) return { allow: false, reason: 'conversa silenciada' };
  }
  if (evt.type === 'notice' && p.n === 0) return { allow: false, reason: 'avisos desativados' };
  if (evt.type === 'meeting' && p.nr === 0) return { allow: false, reason: 'reuniões desativadas' };
  if (evt.type === 'birthday' && p.ns === 0) return { allow: false, reason: 'aniversários desativados' };
  if (me?.st === 'ocup' && evt.type !== 'notice') return { allow: false, reason: 'não incomodar' };
  if (p.quiet && !evt.urgent && evt.type !== 'notice' && !withinWorkHours(me)) return { allow: false, reason: 'fora do expediente' };
  return { allow: true };
}

export function haptic(kind: 'light' | 'medium' | 'heavy' = 'medium') {
  const H = plug('Haptics');
  try {
    if (H) H.impact({ style: kind === 'light' ? 'LIGHT' : kind === 'heavy' ? 'HEAVY' : 'MEDIUM' });
    else if (navigator.vibrate) navigator.vibrate(kind === 'light' ? 8 : 18);
  } catch { /* not supported */ }
}

export function playSound(name: 'msg' | 'aviso') {
  if ((ctx.prefs() || {}).snd === 0) return;
  try {
    const a = new Audio(`/ewwon/sounds/ewwon_${name}.wav`);
    a.volume = 0.8;
    void a.play().catch(() => undefined);
  } catch { /* autoplay blocked */ }
}

const localIcon = (evt: NotifyEvent) => {
  if (evt.type === 'notice') return '/icons/notify-notice.png?v=3';
  if (evt.type === 'birthday') return '/icons/notify-birthday.png?v=3';
  const c = evt.chat;
  if (c?.photo && /^https:/.test(c.photo)) return c.photo;
  return c?.kind === 'group' ? '/icons/notify-group.png?v=3' : c?.kind === 'sector' ? '/icons/notify-sector.png?v=3' : '/icons/notify-person.png?v=3';
};

async function show(evt: NotifyEvent) {
  const p = ctx.prefs() || {};
  const body = p.prev === 0 && evt.type === 'message' ? 'Nova mensagem' : evt.body;
  const channelId = p.snd === 0 && evt.type !== 'notice' ? 'silencioso' : CH_OF[evt.type] || 'mensagens';
  const id = evt.id || hash(evt.type + (evt.chat ? evt.chat.key : '') + Date.now());
  const LN = plug('LocalNotifications');
  if (LN) {
    await LN.schedule({ notifications: [{ id, title: evt.title, body, channelId, smallIcon: 'ic_stat_ewwon', iconColor: '#FFFFFF', group: evt.chat ? 'chat_' + evt.chat.key : undefined, extra: evt.data || {} }] });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(evt.title, { body, icon: localIcon(evt), badge: '/icons/badge-96.png?v=3', tag: evt.chat ? evt.chat.key : evt.type });
      n.onclick = () => { window.focus(); ctx.open(evt.data || {}); };
    } catch {
      // Some mobile browsers only allow notifications through the service worker.
      const reg = await navigator.serviceWorker?.getRegistration?.();
      await reg?.showNotification(evt.title, { body, icon: localIcon(evt), badge: '/icons/badge-96.png?v=3', tag: evt.chat ? evt.chat.key : evt.type, data: evt.data });
    }
  }
}

/** Decides whether to show, how to show (in-app banner vs system) and plays sound/vibration. */
export async function deliver(evt: NotifyEvent): Promise<{ shown: boolean; mode?: 'banner' | 'system'; reason?: string }> {
  const r = shouldNotify(evt);
  if (!r.allow) return { shown: false, reason: r.reason };
  if (fg) {
    playSound(evt.type === 'notice' ? 'aviso' : 'msg');
    if ((ctx.prefs() || {}).vib !== 0) haptic('medium');
    return { shown: true, mode: 'banner' };
  }
  // With Web Push active the server already notifies messages and notices (even with
  // the app closed), so the page doesn't show a second copy.
  if (webPushOn && (evt.type === 'message' || evt.type === 'notice')) return { shown: false, reason: 'web push' };
  await show(evt);
  return { shown: true, mode: 'system' };
}

export function getPermission() { return perm; }

export async function checkPermission() {
  try {
    const LN = plug('LocalNotifications');
    if (LN) {
      const r = await LN.checkPermissions();
      perm = r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'prompt';
    } else if ('Notification' in window) perm = Notification.permission === 'default' ? 'prompt' : (Notification.permission as 'granted' | 'denied');
  } catch { /* ignore */ }
  return perm;
}

export async function ensurePermission() {
  try {
    const LN = plug('LocalNotifications');
    if (LN) {
      let r = await LN.checkPermissions();
      if (r.display === 'prompt' || r.display === 'prompt-with-rationale') r = await LN.requestPermissions();
      perm = r.display === 'granted' ? 'granted' : 'denied';
      if (perm === 'granted') await setupPush();
    } else if ('Notification' in window) {
      const v = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      perm = v === 'default' ? 'prompt' : v;
      if (perm === 'granted') await subscribeWebPush();
    }
  } catch (e) {
    console.warn('permissão de notificação:', e);
  }
  return perm;
}

// ---------------------------------------------------------------- Web Push (PWA)
// Public VAPID key; the private key stays in the database vault (send-push function).
const VAPID_PUBLIC = 'BOT6DPYNW5XRs63_iI4BVRkOOuhIqoy184vKp1Z6ykeffE_ozv2252u-OPG0JSISC9mGwA9UBleGOxZpYgb8i7o';
let webPushOn = false;
export const webPushActive = () => webPushOn;
const b64ToBytes = (b64: string) => { const p = '='.repeat((4 - (b64.length % 4)) % 4); const raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };

/** Subscribes this browser/installed app to server push (works with the app closed). */
export async function subscribeWebPush() {
  try {
    if (isNative() || !('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    const key = sub?.options?.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey as ArrayBuffer) : null;
    const want = b64ToBytes(VAPID_PUBLIC);
    if (sub && key && (key.length !== want.length || key.some((b, i) => b !== want[i]))) { await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want });
    const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return false;
    await ctx.savePush?.({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
    webPushOn = true;
    return true;
  } catch (e) {
    console.warn('web push:', e);
    return false;
  }
}

let pushReady = false;
async function setupPush() {
  const PN = plug('PushNotifications');
  if (pushReady || !PN) return;
  pushReady = true;
  PN.addListener('registration', (t: AnyObj) => ctx.onToken?.(t.value));
  PN.addListener('registrationError', (e: AnyObj) => console.warn('Falha ao registrar push:', e));
  PN.addListener('pushNotificationReceived', (n: AnyObj) => {
    const d = n.data || {};
    const chat = d.chatId ? ctx.chat(d.chatId) : null;
    void deliver({ type: d.type || 'message', chat, urgent: d.urgent === '1', title: n.title, body: n.body, data: d, id: hash(n.id || String(Date.now())) })
      .then((r) => { if (r.mode === 'banner') ctx.banner({ title: n.title, body: n.body, data: d }); });
  });
  PN.addListener('pushNotificationActionPerformed', (a: AnyObj) => ctx.open(a.notification?.data || {}));
  try { await PN.register(); } catch (e) { console.warn(e); }
}

export async function scheduleDaily(o: { id: number; hour: number; minute: number; title: string; body: string; channel?: string }) {
  const LN = plug('LocalNotifications');
  if (!LN) return;
  await LN.schedule({ notifications: [{ id: o.id, title: o.title, body: o.body, channelId: o.channel || 'aniversarios', smallIcon: 'ic_stat_ewwon', schedule: { on: { hour: o.hour, minute: o.minute }, allowWhileIdle: true } }] });
}

export async function scheduleMeeting(o: { id: number; title: string; at: string; minutesBefore?: number }) {
  const LN = plug('LocalNotifications');
  const before = o.minutesBefore ?? 10;
  const when = new Date(new Date(o.at).getTime() - before * 60000);
  if (when < new Date()) return;
  if (LN) {
    await LN.schedule({ notifications: [{ id: o.id, title: `Reunião em ${before} min`, body: o.title, channelId: 'reunioes', smallIcon: 'ic_stat_ewwon', schedule: { at: when, allowWhileIdle: true } }] });
    return;
  }
  // Browser: best effort while the app stays open.
  const ms = when.getTime() - Date.now();
  if (ms < 2 ** 31 - 1) window.setTimeout(() => void deliver({ type: 'meeting', title: `Reunião em ${before} min`, body: o.title, data: { type: 'meeting' } }).then((r) => { if (r.mode === 'banner') ctx.banner({ title: `Reunião em ${before} min`, body: o.title, data: { type: 'meeting' } }); }), ms);
}

let backHandler: (() => boolean) | null = null;
let resumeHandler: (() => void) | null = null;
export const setBackHandler = (f: () => boolean) => { backHandler = f; };
export const setResumeHandler = (f: () => void) => { resumeHandler = f; };
// Short trips out of the app (file picker, camera, opening a file) don't reload anything:
// realtime keeps the data fresh. Only a longer absence refreshes the whole app.
let hiddenAt = 0;
const resumed = () => { const away = hiddenAt ? Date.now() - hiddenAt : 0; hiddenAt = 0; if (away > 30_000) resumeHandler?.(); };

let started = false;
export async function init(context: Ctx) {
  ctx = { ...ctx, ...context };
  if (started) return;
  started = true;
  document.addEventListener('visibilitychange', () => { fg = !document.hidden; if (fg) resumed(); else hiddenAt = Date.now(); });
  if (!isNative() && typeof Notification !== 'undefined' && Notification.permission === 'granted') void subscribeWebPush();
  // Tapping a system notification while the app is running opens that chat.
  navigator.serviceWorker?.addEventListener?.('message', (e: MessageEvent) => {
    const m = e.data || {};
    if (m.type !== 'ewvon-open' || !m.url) return;
    const q = new URL(m.url, location.origin).searchParams;
    const chat = q.get('chat');
    ctx.open(chat ? { type: 'message', chatId: chat } : q.get('tab') === 'notices' ? { type: 'notice' } : q.get('tab') === 'birthdays' ? { type: 'birthday' } : {});
  });
  const LN = plug('LocalNotifications');
  if (LN) {
    for (const c of CHANNELS) { try { await LN.createChannel(c); } catch (e) { console.warn('canal', c.id, e); } }
    LN.addListener('localNotificationActionPerformed', (a: AnyObj) => ctx.open(a.notification?.extra || {}));
  }
  if (isNative()) {
    const SB = plug('StatusBar'), SS = plug('SplashScreen'), A = plug('App');
    try { if (SB) { await SB.setStyle({ style: 'DARK' }); await SB.setBackgroundColor({ color: '#08080a' }); } } catch { /* ignore */ }
    try {
      A?.addListener('backButton', () => { const handled = backHandler?.(); if (handled) return; if (A.minimizeApp) A.minimizeApp(); else A.exitApp(); });
      A?.addListener('appStateChange', (s: AnyObj) => { fg = !!s.isActive; if (s.isActive) resumed(); else hiddenAt = Date.now(); });
    } catch { /* ignore */ }
    try { if (SS) window.setTimeout(() => SS.hide(), 300); } catch { /* ignore */ }
  } else {
    // Browser/PWA: the hardware/gesture back button pops our in-app history entry.
    window.history.pushState({ ewwon: 1 }, '');
    window.addEventListener('popstate', () => {
      if (backHandler?.()) window.history.pushState({ ewwon: 1 }, '');
    });
  }
  await checkPermission();
  if (perm === 'granted') void setupPush();
}

export function updateContext(context: Partial<Ctx>) { ctx = { ...ctx, ...context }; }

// Soft chat UI sounds (iPhone-WhatsApp-like), synthesized with Web Audio so they start instantly and need no files:
// 'type' = faint tick while typing (throttled), 'send' = short rising pop, 'recv' = gentle two-note chime for a message
// that arrives in the conversation you have open. All respect "Som das mensagens" (prefs.snd).
let uiCtx: AudioContext | null = null;
let lastTick = 0;
export function uiSound(kind: 'type' | 'send' | 'recv') {
  if ((ctx.prefs() || {}).snd === 0) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!uiCtx) uiCtx = new AC();
    const a = uiCtx;
    if (a.state === 'suspended') void a.resume();
    const t0 = a.currentTime + 0.005;
    const tone = (f0: number, f1: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine') => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, start);
      o.frequency.exponentialRampToValueAtTime(f1, start + dur);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.012, dur / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g).connect(a.destination);
      o.start(start); o.stop(start + dur + 0.02);
    };
    // soft, low sounds (owner: "mais grave que agudo"): a keyboard-like tap while typing, a deep warm "bloop" on send
    const lp = (freq: number) => { const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = 0.7; f.connect(a.destination); return f; };
    const soft = (f0: number, f1: number, start: number, dur: number, vol: number, cut = 1400) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, start);
      o.frequency.exponentialRampToValueAtTime(f1, start + dur);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g).connect(lp(cut));
      o.start(start); o.stop(start + dur + 0.03);
    };
    if (kind === 'type') {
      const now = performance.now();
      if (now - lastTick < 90) return;
      lastTick = now;
      // a very soft, low, muted "tok" (no noise: the noise burst sounded harsh on phone speakers)
      const f = 210 + Math.random() * 40;
      soft(f, f * 0.7, t0, 0.045, 0.035, 520);
    } else if (kind === 'send') {
      // deep and round, like a corporate chat send
      soft(330, 196, t0, 0.17, 0.16, 1100);
      soft(165, 110, t0, 0.2, 0.12, 500);
    } else {
      soft(523, 523, t0, 0.16, 0.07, 1600);
      soft(392, 392, t0 + 0.11, 0.24, 0.07, 1400);
    }
  } catch { /* audio not available */ }
}
