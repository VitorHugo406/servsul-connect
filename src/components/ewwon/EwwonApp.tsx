// Ewwon mobile app — React port of the "Ewwon · App mobile" prototype,
// backed by the existing Supabase data (see ./data.ts).
import { useVoiceRecorder, Lock } from '@/components/common/Voice';
import { fmtDuration, sendVoice, watchKeyRequests } from '@/lib/e2e';
import { PermissionGate, needsPermissionGate } from './permgate';
import { StickerPicker, StickerMessage } from '@/components/common/Stickers';
import { addFavorite, isSticker, parseSticker, stickerContent } from '@/lib/stickers';
import { isSystemSender } from '@/lib/systemSender';
import { CosmicBlob } from '@/components/common/CosmicBlob';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFileUpload } from '@/hooks/useFileUpload';
import * as CT from '@/lib/chatTasks';
import './ewwon.css';
import './ewwon-app.css';
import * as D from './data';
import type { Chat, Msg, Person, Prefs, Boot, Notice } from './data';
import * as N from './notify';
import { I, Chev } from './icons';
import { ST, StatusKey, fitTextarea, fmtTime, hm, safeStore } from './util';
import { runTour, type TourController } from './tour';
import { EwwonPage, type PageSpec } from './pages';
import { TicketsDesk } from './tickets';
import { EwwonLoader } from '@/components/common/EwwonLoader';
import { MsgBody, ImageViewer, previewText } from './msgbody';
import { TasksSheet } from './tasksheet';


const gr = (h: number) => `hsl(${h} 30% 30%)`;
export const avStyle = (p: { photo: string | null; hue: number }) => (p.photo ? { background: `url("${p.photo}") center/cover` } : { background: gr(p.hue) });
export const covStyle = (p: { cover: string | null; hue: number }) => (p.cover ? { background: `url("${p.cover}") center/cover` } : { background: `hsl(${p.hue} 32% 24%)` });

export function Av({ p, cls = '', onClick, st }: { p: { id?: string; photo: string | null; hue: number; i: string; sys?: boolean }; cls?: string; onClick?: (e: React.MouseEvent) => void; st?: StatusKey | null }) {
  if (p.sys || isSystemSender(p.id)) return <div className={`av ewx-sysav${cls ? ' ' + cls : ''}`} data-p={p.id || ''}><CosmicBlob size={48} /></div>;
  return (
    <div className={`av${st ? ' on' : ''}${cls ? ' ' + cls : ''}`} data-p={p.id || ''} onClick={onClick}
      style={{ ...avStyle(p), ['--sc' as string]: st ? ST[st][1] : '#46d37b' }}>
      {p.photo ? '' : p.i}
    </div>
  );
}

export function Seg({ items, value, onChange, id }: { items: string[]; value: number; onChange: (v: number) => void; id?: string }) {
  return (
    <div className="segc" data-id={id}>
      {items.map((x, i) => <button key={x} data-v={i} className={i === value ? 'on' : ''} onClick={(e) => { e.stopPropagation(); onChange(i); }}>{x}</button>)}
    </div>
  );
}

export function Tg({ t, d, on, onChange, id }: { t: string; d: string; on: boolean; onChange: (v: boolean) => void; id?: string }) {
  return (
    <div className="opt" data-t={id} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <div>{t}<small>{d}</small></div><span className={'sw' + (on ? ' on' : '')} />
    </div>
  );
}

const MUTE_MS = [3600e3, 8 * 3600e3, 0];
const dayKey = (iso: string) => new Date(iso).toDateString();
function dayLabel(iso: string) {
  const d = new Date(iso); const t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Hoje';
  if (d.toDateString() === y.toDateString()) return 'Ontem';
  const diff = (t.getTime() - d.getTime()) / 864e5;
  if (diff < 7) { const w = d.toLocaleDateString('pt-BR', { weekday: 'long' }); return w.charAt(0).toUpperCase() + w.slice(1); }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: d.getFullYear() === t.getFullYear() ? undefined : 'numeric' });
}
const REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏'];
const EMOJIS = '😀 😃 😄 😁 😆 😅 😂 🙂 😉 😊 😍 🥰 😘 😎 🤩 🥳 🤔 🤗 🙄 😴 😮 😢 😭 😡 🤯 😱 👍 👎 👏 🙌 🙏 💪 👋 🤝 ✌️ 👌 ❤️ 🧡 💛 💚 💙 💜 🔥 ✨ ⭐ 🎉 🎂 🎁 ✅ ❌ ⚠️ 📌 📎 📷 💬 📅 ⏰ 🚀 💡 ☕'.split(' ');
const WISHES = ['Parabéns! 🎉', 'Felicidades 🎂', 'Feliz niver! 🥳'];
type GsSpec = { kind: 'status' } | { kind: 'member'; id: string } | { kind: 'add' } | { kind: 'notice' } | { kind: 'newchat' } | { kind: 'newgroup' } | { kind: 'tasks'; mode: 0 | 1 };

export interface EwApi {
  boot: Boot; people: Record<string, Person>; chats: Chat[]; prefs: Prefs; cur: Chat | null; me: Person;
  toast: (t: string) => void; pgShow: (p: PageSpec) => void; pgBack: () => void; pgClose: () => void; gsOpen: (g: GsSpec) => void;
  setPrefs: (p: Prefs) => void; patchChat: (key: string, fn: (c: Chat) => Chat) => void; patchPerson: (id: string, fn: (p: Person) => Person) => void;
  openDm: (personId: string) => void; setStatus: (k: StatusKey, clearMs?: number | null) => void; saveMe: (p: Person) => void;
  pickImg: (cb: (file: File, dataUrl: string) => void) => void; setTheme: (v: number) => void; perm: string; askPerm: () => void;
  tickets: D.Ticket[]; setTickets: (t: D.Ticket[]) => void; sv: <T>(p: Promise<T>) => Promise<T | undefined>;
  reload: () => Promise<void>; openChat: (key: string) => void;
}

export default function EwwonApp() {
  const { profile, isAdmin, allAccessibleSectorIds, canAccess, signOut } = useAuth();
  const [boot, setBoot] = useState<Boot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [chats, setChats] = useState<Chat[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [tickets, setTickets] = useState<D.Ticket[]>([]);
  const [prefs, setPrefsState] = useState<Prefs>(D.DEFAULT_PREFS);
  const [tab, setTab] = useState(0);
  const [curKey, setCurKey] = useState<string | null>(null);
  const [roomOn, setRoomOn] = useState(false);
  const [sheetOn, setSheetOn] = useState(false);
  const [pages, setPages] = useState<PageSpec[]>([]);
  const [gs, setGs] = useState<GsSpec | null>(null);
  const [toastTxt, setToastTxt] = useState('');
  const [toastOn, setToastOn] = useState(false);
  const [ban, setBan] = useState<{ title: string; body: string; data: Record<string, string>; av?: Chat | null } | null>(null);
  const [draft, setDraft] = useState('');
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [cfl, setCfl] = useState<'all' | 'un' | 'set' | 'p'>('all');
  const [ddOn, setDdOn] = useState(false);
  const [openNotice, setOpenNotice] = useState<Record<string, boolean>>({});
  const [seg, setSeg] = useState<'7' | '30'>('7');
  const [bmsg, setBmsg] = useState(WISHES[0]);
  const [bdSent, setBdSent] = useState<Record<string, boolean>>({});
  const [reminders, setReminders] = useState<Record<string, boolean>>(() => safeStore.get('bdayReminders', {}));
  const [typingMap, setTypingMap] = useState<Record<string, string[]>>({});
  const typingSent = useRef(0);
  const [perm, setPerm] = useState<string>(N.getPermission());
  const [tourOn, setTourOn] = useState(false);
  const [ctMenu, setCtMenu] = useState<Chat | null>(null);
  const [dots, setDots] = useState(false);
  const [search, setSearch] = useState<{ q: string; i: number } | null>(null);
  const [dayFloat, setDayFloat] = useState<string | null>(null);
  // Swipe-to-reply (WhatsApp-like): the message being answered, shown above the composer.
  const [reply, setReply] = useState<Msg | null>(null);
  const replyRef = useRef<Msg | null>(null);
  const startReply = (m: Msg) => { replyRef.current = m; setReply(m); N.haptic('light'); window.setTimeout(() => inpRef.current?.focus(), 30); };
  const cancelReply = () => { replyRef.current = null; setReply(null); };
  // WhatsApp-like "jump to latest" button: shows after scrolling up; counts new messages meanwhile.
  const [far, setFar] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const farRef = useRef(false);
  // Stay glued to the bottom while photos, stickers and link previews finish loading.
  const stickRef = useRef(true);
  const lenRef = useRef<{ key: string | null; n: number }>({ key: null, n: 0 });
  const dayTimer = useRef<number>(0);
  const ctHold = useRef<{ t: number; fired: boolean }>({ t: 0, fired: false });
  const [groupWm, setGroupWm] = useState<number | null>(null);
  const [permGate, setPermGate] = useState(() => needsPermissionGate());
  const [statusClear, setStatusClear] = useState(3);
  const [deskCount, setDeskCount] = useState(0);
  const [attOn, setAttOn] = useState<false | 'menu' | 'emoji' | 'sticker'>(false);
  const [pending, setPending] = useState<{ file: File; url: string | null; name: string; size: number; image: boolean }[]>([]);
  const [sending, setSending] = useState(false);
  const [viewer, setViewer] = useState<{ src: string; url: string; name: string; caption?: string } | null>(null);
  const [tasksOn, setTasksOn] = useState<Record<string, { enabled: boolean; manage: boolean }>>({});
  const attRef = useRef<HTMLInputElement>(null);
  const { uploadFile } = useFileUpload();

  const rootRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const msgsRef = useRef<HTMLDivElement>(null);
  const inpRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { fitTextarea(inpRef.current); }, [draft]);
  const fiRef = useRef<HTMLInputElement>(null);
  const hbRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const stateRef = useRef({ chats, people, prefs, curKey, roomOn, tab });
  stateRef.current = { chats, people, prefs, curKey, roomOn, tab };

  const meId = profile?.id || '';
  const meIdRef = useRef(meId); meIdRef.current = meId;
  const companyRef = useRef(''); companyRef.current = boot?.companyId || '';
  const me = people[meId] || boot?.me;
  const cur = useMemo(() => chats.find((c) => c.key === curKey) || null, [chats, curKey]);
  const hits = useMemo(() => {
    const q = search?.q.trim().toLowerCase();
    if (!q || !cur) return [] as string[];
    return cur.m.filter((m) => D.plainText(m.t).toLowerCase().includes(q)).map((m) => m.id).reverse();
  }, [search?.q, cur]);
  useEffect(() => {
    document.querySelectorAll('.ewx-hit').forEach((el) => el.classList.remove('ewx-hit'));
    const id = hits[search?.i ?? 0];
    if (!id) return;
    const el = document.querySelector(`[data-mid="${id}"]`);
    if (el) { stickRef.current = false; el.classList.add('ewx-hit'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }, [hits, search?.i]);
  useEffect(() => { setSearch(null); setDots(false); setDayFloat(null); replyRef.current = null; setReply(null); }, [curKey, roomOn]);
  const onMsgsScroll = () => {
    const box = msgsRef.current;
    if (!box) return;
    const dist = box.scrollHeight - box.scrollTop - box.clientHeight;
    const isFar = dist > 320;
    if (isFar !== farRef.current) { farRef.current = isFar; setFar(isFar); }
    stickRef.current = dist < 60;
    if (dist < 80) setNewBelow(0);
    const top = box.getBoundingClientRect().top + 8;
    let label: string | null = null;
    box.querySelectorAll<HTMLElement>('.ewx-dsep').forEach((el) => { if (el.getBoundingClientRect().top <= top) label = el.dataset.day || null; });
    if (!label) { const first = box.querySelector<HTMLElement>('.ewx-dsep'); label = first?.dataset.day || null; }
    setDayFloat(label);
    window.clearTimeout(dayTimer.current);
    dayTimer.current = window.setTimeout(() => setDayFloat(null), 1500);
  };

  // ------------------------------------------------------------ helpers
  const toast = useCallback((t: string) => {
    setToastTxt(t); setToastOn(true);
    window.clearTimeout((toast as unknown as { _t?: number })._t);
    (toast as unknown as { _t?: number })._t = window.setTimeout(() => setToastOn(false), 2200);
  }, []);
  useEffect(() => { const f = (e: Event) => toast(String((e as CustomEvent).detail || '')); window.addEventListener('ew:toast', f); return () => window.removeEventListener('ew:toast', f); }, [toast]);
  const sv = useCallback(<T,>(p: Promise<T>) => p.catch((e) => { console.warn('Ewwon:', e); toast('Não foi possível salvar. Tente novamente.'); return undefined; }), [toast]);
  const patchChat = useCallback((key: string, fn: (c: Chat) => Chat) => setChats((cs) => cs.map((c) => (c.key === key ? fn(c) : c))), []);
  const patchPerson = useCallback((id: string, fn: (p: Person) => Person) => setPeople((ps) => (ps[id] ? { ...ps, [id]: fn(ps[id]) } : ps)), []);

  // ------------------------------------------------------------ boot
  const sectorsKey = (allAccessibleSectorIds || []).join(',');
  const canPostPerm = canAccess('can_post_announcements' as never);
  const loadingRef = useRef<Promise<void> | null>(null);
  const load = useCallback(async () => {
    if (!profile?.id || !profile.company_id) return;
    if (loadingRef.current) return loadingRef.current; // one boot at a time
    const run = (async () => {
    try {
      setErr(null);
      const b = await D.bootstrap({
        profileId: profile.id, companyId: profile.company_id, isAdmin, accessibleSectorIds: allAccessibleSectorIds || [],
        canPostNotices: isAdmin || ['admin', 'gerente'].includes(profile.autonomy_level || '') || canPostPerm,
      });
      for (const c of b.chats) if (c.kind === 'sector') D.primeSectorRead(profile.id, c.id);
      // A reload (resume after the file picker, token refresh…) keeps the messages already
      // on screen; chats are only marked stale and refreshed in the background.
      setBoot(b); setPeople(b.people); setNotices(b.notices); setTickets(b.tickets); setPrefsState(b.prefs);
      setChats((prev) => {
        if (!prev.length) return b.chats;
        const old = new Map(prev.map((c) => [c.key, c]));
        const next = b.chats.map((c) => { const o = old.get(c.key); return o && o.m.length ? { ...c, m: o.m, loaded: false } : c; });
        for (const o of prev) if (!next.some((c) => c.key === o.key) && o.kind === 'dm') next.push({ ...o, loaded: false });
        return next;
      });
      const open = stateRef.current.roomOn ? stateRef.current.curKey : null;
      if (open) {
        const c = b.chats.find((x) => x.key === open) || stateRef.current.chats.find((x) => x.key === open);
        if (c) void D.loadMessages(c, profile.id).then((m) => setChats((cs) => cs.map((x) => (x.key === open ? { ...x, m: mergeMsgs(m, x.m), loaded: true } : x)))).catch(() => setChats((cs) => cs.map((x) => (x.key === open ? { ...x, loaded: true } : x))));
      }
    } catch (e) {
      console.error('Ewwon bootstrap', e);
      setErr('Não foi possível carregar o Ewwon.');
    }
    })();
    loadingRef.current = run;
    try { await run; } finally { loadingRef.current = null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.company_id, profile?.autonomy_level, isAdmin, sectorsKey, canPostPerm]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (document.getElementById('ewwon-font')) return;
    const l = document.createElement('link');
    l.id = 'ewwon-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
  }, []);

  // theme + reduced motion
  const themeAttr = prefs.theme === 2 ? undefined : prefs.theme === 1 ? 'light' : 'dark';
  const setTheme = useCallback((v: number) => setPrefsState((p) => ({ ...p, theme: v })), []);
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const prev = meta?.content;
    if (meta) meta.content = themeAttr === 'light' ? '#eceef3' : '#08080a';
    return () => { if (meta && prev) meta.content = prev; };
  }, [themeAttr]);

  const savePrefsT = useRef<number>();
  const setPrefs = useCallback((p: Prefs) => {
    setPrefsState(p);
    window.clearTimeout(savePrefsT.current);
    savePrefsT.current = window.setTimeout(() => void sv(D.savePrefs(p, meIdRef.current, companyRef.current)), 500);
  }, [sv]);

  // ------------------------------------------------------------ navigation
  const go = useCallback((n: number) => { setTab(n); }, []);
  const pgShow = useCallback((p: PageSpec) => setPages((s) => [...s, p]), []);
  const pgBack = useCallback(() => setPages((s) => s.slice(0, -1)), []);
  const pgClose = useCallback(() => setPages([]), []);
  const gsOpen = useCallback((g: GsSpec) => setGs(g), []);
  const gsClose = useCallback(() => setGs(null), []);

  const upd = useCallback((x: number) => {
    const main = mainRef.current, panel = panelRef.current, phone = phoneRef.current;
    if (!main || !panel || !phone) return;
    const W = phone.offsetWidth * 0.78;
    const p = W ? x / W : 0;
    if (x > 0) { main.style.borderRadius = '36px'; main.style.boxShadow = '-30px 0 60px rgba(0,0,0,.35)'; }
    main.style.transform = `translate3d(${x}px,0,0) scale(${1 - 0.12 * p})`;
    panel.style.opacity = String(0.3 + 0.7 * p);
    panel.style.transform = `translate3d(${(p - 1) * 40}px,0,0)`;
    if (scrimRef.current) scrimRef.current.style.pointerEvents = p > 0.05 ? 'auto' : 'none';
  }, []);
  const setOpen = useCallback((o: boolean) => {
    openRef.current = o;
    const main = mainRef.current, panel = panelRef.current, phone = phoneRef.current;
    if (!main || !panel || !phone) return;
    main.style.transition = panel.style.transition = '';
    upd(o ? phone.offsetWidth * 0.78 : 0);
    if (!o) window.setTimeout(() => { if (!openRef.current && mainRef.current) { mainRef.current.style.borderRadius = '0'; mainRef.current.style.boxShadow = ''; } }, 520);
  }, [upd]);

  // drawer swipe (any tab): same thresholds as the prototype
  useEffect(() => {
    const phone = phoneRef.current;
    if (!phone || !boot) return;
    let sx = 0, sy = 0, lx = 0, dir: boolean | null = null, moved = 0, track = false, W = 0;
    const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const st = (x: number, y: number, t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      const r = rootRef.current;
      if (!el || !r || r.dataset.tour === '1' || r.querySelector('#pg.on') || r.querySelector('#gs.on') || r.querySelector('#room.on') || el.closest('input,textarea,select,.pick,.sheet,.ewx-chart,.seg,.chips,.fchip')) { track = false; return; }
      sx = lx = x; sy = y; dir = null; moved = 0; track = true; W = phone.offsetWidth * 0.78;
    };
    const mv = (x: number, y: number, ev: Event) => {
      if (!track) return;
      lx = x;
      const dx = x - sx, dy = y - sy;
      if (dir === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) dir = Math.abs(dx) > Math.abs(dy) * 1.2;
      if (!dir) return;
      if (ev.cancelable) ev.preventDefault();
      moved = Math.abs(dx);
      if (openRef.current || dx > 0) {
        if (mainRef.current && panelRef.current) mainRef.current.style.transition = panelRef.current.style.transition = 'none';
        upd(cl((openRef.current ? W : 0) + dx, 0, W));
      }
    };
    const en = () => {
      if (!track) return;
      track = false;
      if (dir) { const dx = lx - sx; if (openRef.current) setOpen(cl(W + dx, 0, W) > W * 0.6); else setOpen(dx > W * 0.28); }
      dir = null;
    };
    const ts = (e: TouchEvent) => st(e.touches[0].clientX, e.touches[0].clientY, e.target);
    const tm = (e: TouchEvent) => mv(e.touches[0].clientX, e.touches[0].clientY, e);
    const md = (e: MouseEvent) => st(e.clientX, e.clientY, e.target);
    const mm = (e: MouseEvent) => mv(e.clientX, e.clientY, e);
    const click = (e: MouseEvent) => { if (moved > 10) { e.stopPropagation(); e.preventDefault(); moved = 0; } };
    phone.addEventListener('touchstart', ts, { passive: true });
    phone.addEventListener('touchmove', tm, { passive: false });
    phone.addEventListener('touchend', en);
    phone.addEventListener('touchcancel', en);
    phone.addEventListener('mousedown', md);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', en);
    phone.addEventListener('click', click, true);
    return () => {
      phone.removeEventListener('touchstart', ts); phone.removeEventListener('touchmove', tm); phone.removeEventListener('touchend', en);
      phone.removeEventListener('touchcancel', en); phone.removeEventListener('mousedown', md); window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', en); phone.removeEventListener('click', click, true);
    };
  }, [boot, upd, setOpen]);

  // ------------------------------------------------------------ chat
  const isMuted = N.isChatMuted;
  const ent = useCallback((c: Chat) => (c.p ? people[c.p] : null), [people]);

  const openRoom = useCallback(async (key: string) => {
    const c = stateRef.current.chats.find((x) => x.key === key);
    if (!c || !meId) return;
    setCurKey(key); setSheetOn(false); setRoomOn(true); setPickFor(null); setAttOn(false); setPending([]);
    const sk = CT.chatSettingsKey(c.kind, c.id, meId);
    void Promise.all([CT.getTasksEnabled(sk), CT.canManageChat(sk)]).then(([enabled, manage]) => setTasksOn((t) => ({ ...t, [key]: { enabled, manage } }))).catch(() => undefined);
    if (c.u) { patchChat(key, (x) => ({ ...x, u: 0 })); }
    void sv(D.markRead(c, meId));
    if (!c.loaded) {
      try {
        const m = await D.loadMessages(c, meId);
        patchChat(key, (x) => ({ ...x, m: mergeMsgs(m, x.m), loaded: true }));
      } catch (e) { console.warn(e); toast('Não foi possível carregar as mensagens.'); }
    }
  }, [meId, patchChat, sv, toast]);
  const closeRoom = useCallback(() => { setSheetOn(false); setRoomOn(false); setPickFor(null); inpRef.current?.blur(); }, []);

  useEffect(() => {
    if (!roomOn) { lenRef.current = { key: null, n: 0 }; farRef.current = false; setFar(false); setNewBelow(0); return; }
    const b = msgsRef.current;
    const n = cur?.m.length || 0;
    const prev = lenRef.current;
    lenRef.current = { key: curKey, n };
    if (prev.key === curKey && n > prev.n && farRef.current && !cur?.m[n - 1]?.me) { setNewBelow((x) => x + (n - prev.n)); return; }
    if (prev.key !== curKey) { farRef.current = false; setFar(false); setNewBelow(0); }
    stickRef.current = true;
    if (b) b.scrollTop = b.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomOn, cur?.m.length, curKey]);
  useEffect(() => {
    const b = msgsRef.current;
    if (!b || !roomOn) return;
    const pin = () => { if (stickRef.current) b.scrollTop = b.scrollHeight; };
    const mo = new MutationObserver(pin);
    mo.observe(b, { childList: true, subtree: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(pin) : null;
    ro?.observe(b);
    b.addEventListener('load', pin, true); // images/stickers (load does not bubble, so capture)
    const t = window.setTimeout(pin, 650); // after the room slide-in animation
    return () => { mo.disconnect(); ro?.disconnect(); b.removeEventListener('load', pin, true); window.clearTimeout(t); };
  }, [roomOn, curKey]);
  const jumpToMsg = (id: string) => {
    const el = msgsRef.current?.querySelector<HTMLElement>(`[data-mid="${id}"]`);
    if (!el) { toast('Mensagem antiga: não está carregada'); return; }
    stickRef.current = false;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('ewx-flash'); void el.offsetWidth; el.classList.add('ewx-flash');
    window.setTimeout(() => el.classList.remove('ewx-flash'), 1600);
  };
  const jumpToEnd = () => {
    const b = msgsRef.current;
    if (!b) return;
    stickRef.current = true;
    b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' });
    setNewBelow(0);
  };

  const openDm = useCallback((personId: string) => {
    const existing = stateRef.current.chats.find((c) => c.key === `dm:${personId}`);
    if (!existing) {
      const p = stateRef.current.people[personId];
      if (!p) return;
      setChats((cs) => [D.makeDm(p, null, 0, meId, null), ...cs]);
    }
    setPages([]); setGs(null); setTab(1);
    window.setTimeout(() => void openRoom(`dm:${personId}`), 30);
  }, [meId, openRoom]);

  const sendChain = useRef<Promise<unknown>>(Promise.resolve());
  const tmpSeq = useRef(0);
  const send = useCallback(async (txt: string) => {
    const c = stateRef.current.chats.find((x) => x.key === stateRef.current.curKey);
    if (!c || !boot) return;
    const tmpId = `tmp-${Date.now()}-${++tmpSeq.current}`;
    const at = new Date().toISOString();
    const rp = replyRef.current && !replyRef.current.id.startsWith('tmp-') ? replyRef.current.id : null;
    replyRef.current = null; setReply(null);
    const m: Msg = { id: tmpId, t: txt, at, h: hm(), me: true, from: null, r: [], mine: [], pending: true, rp };
    patchChat(c.key, (x) => ({ ...x, m: [...x.m, m], last: { t: txt, at, me: true, from: meId } }));
    setChats((cs) => { const a = [...cs]; D.sortChats(a); return a; });
    // One insert at a time, in the order the person tapped "send": parallel requests could reach
    // the server out of order and the conversation would be shuffled after a reload.
    const job = sendChain.current.catch(() => undefined).then(() => D.sendMessage(c, meId, boot.companyId, txt, rp));
    sendChain.current = job.then(() => undefined, () => undefined);
    try {
      const r = await job;
      patchChat(c.key, (x) => ({ ...x, m: D.orderMsgs(x.m.map((y) => (y.id === tmpId ? { ...y, id: r.id, at: r.at, pending: false } : y))) }));
    } catch (e) {
      console.warn(e);
      patchChat(c.key, (x) => ({ ...x, m: x.m.filter((y) => y.id !== tmpId) }));
      if (!isSticker(txt)) setDraft(txt);
      toast('Mensagem não enviada. Tente novamente.');
    }
  }, [boot, meId, patchChat, toast]);

  const voiceRec = useVoiceRecorder(300);
  // WhatsApp-like: hold the mic to record, release to send, slide left to cancel, slide up to lock.
  const [recUi, setRecUi] = useState<{ mode: 'hold' | 'lock'; dx: number; dy: number } | null>(null);
  const micG = useRef<{ id: number; x: number; y: number; t: number; mode: 'hold' | 'lock' | 'done'; ready: boolean } | null>(null);
  const micDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || micG.current) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const g = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), mode: 'hold' as const, ready: false };
    micG.current = g;
    setRecUi({ mode: 'hold', dx: 0, dy: 0 });
    N.haptic('light');
    voiceRec.start().then(() => {
      g.ready = true;
      if (micG.current !== g) voiceRec.cancel(); // released or cancelled while the mic was opening
    }).catch(() => { if (micG.current === g) micG.current = null; setRecUi(null); toast('Permita o microfone para gravar áudio'); });
  };
  const micMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = micG.current;
    if (!g || g.id !== e.pointerId || g.mode !== 'hold') return;
    const dx = Math.min(0, e.clientX - g.x), dy = Math.min(0, e.clientY - g.y);
    if (dy < -70 && dy < dx) { g.mode = 'lock'; N.haptic('medium'); setRecUi({ mode: 'lock', dx: 0, dy: 0 }); return; }
    if (dx < -110) { g.mode = 'done'; micG.current = null; voiceRec.cancel(); setRecUi(null); N.haptic('light'); toast('Áudio cancelado'); return; }
    setRecUi({ mode: 'hold', dx, dy });
  };
  const micUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = micG.current;
    if (!g || g.id !== e.pointerId) return;
    if (g.mode === 'lock') return; // keeps recording; trash or send finish it
    micG.current = null;
    setRecUi(null);
    if (Date.now() - g.t < 600 || !g.ready) { voiceRec.cancel(); toast('Segure para gravar, solte para enviar'); return; }
    void sendVoiceNote();
  };
  const sendVoiceNote = async () => {
    micG.current = null; setRecUi(null);
    const c = stateRef.current.chats.find((x) => x.key === stateRef.current.curKey);
    const r = await voiceRec.stop();
    if (!r || !c) { if (!r) toast('Áudio muito curto'); return; }
    setSending(true);
    try {
      const content = await sendVoice(r.blob, r.seconds, c.mem.length ? c.mem : [c.id], meId, c.key);
      await send(content);
    } catch (e) { toast((e as Error).message || 'Não foi possível enviar o áudio'); }
    finally { setSending(false); }
  };
  const doSend = async () => {
    const v = draft.trim();
    if (!v && !pending.length) return;
    if (!pending.length) { setDraft(''); void send(v); inpRef.current?.focus(); return; }
    setSending(true);
    const lines: string[] = [];
    for (const f of pending) {
      const r = await uploadFile(f.file, 'attachments', undefined, { chat: true });
      if (!r) { setSending(false); return; }
      lines.push(`${r.fileType.startsWith('image/') ? '📷' : '📎'} [${r.fileName}](${r.url})`);
    }
    setSending(false);
    setPending([]); setDraft(''); setAttOn(false);
    void send([v, ...lines].filter(Boolean).join('\n'));
  };
  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const items = Array.from(list).slice(0, 10).map((file) => ({ file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null, name: file.name, size: file.size, image: file.type.startsWith('image/') }));
    setPending((p) => [...p, ...items].slice(0, 10));
    setAttOn(false);
  };
  const pickAttach = (accept: string, capture?: boolean) => {
    const el = attRef.current;
    if (!el) return;
    el.value = ''; el.accept = accept;
    if (capture) el.setAttribute('capture', 'environment'); else el.removeAttribute('capture');
    el.click();
  };
  const chatKeyFor = (c: Chat) => CT.chatSettingsKey(c.kind, c.id, meId);

  const burst = (bubbleWrap: HTMLElement | null, x: string) => {
    if (!bubbleWrap || prefs.red) return;
    window.requestAnimationFrame(() => {
      const chip = [...bubbleWrap.querySelectorAll('.rx span')].find((s) => s.textContent === x) as HTMLElement | undefined;
      if (!chip) return;
      chip.classList.add('boom');
      const a = chip.getBoundingClientRect(), b = bubbleWrap.getBoundingClientRect();
      const cx = a.left - b.left + a.width / 2, cy = a.top - b.top + a.height / 2;
      const els: HTMLElement[] = [];
      for (let i = 0; i < 22; i++) {
        const p = document.createElement('span');
        const ang = Math.random() * 6.283, r = 40 + Math.random() * 85, s = 10 + Math.random() * 15;
        p.className = 'bp';
        p.textContent = x === '❤️' && i % 6 === 5 ? '💖' : x;
        p.style.cssText = `left:${cx - s / 2}px;top:${cy - s / 2}px;--s:${s}px;--dx:${Math.cos(ang) * r}px;--dy:${Math.sin(ang) * r - 26}px;--r:${(Math.random() - 0.5) * 100}deg;--d:${Math.random() * 0.22}s`;
        els.push(p); bubbleWrap.appendChild(p);
      }
      window.setTimeout(() => { els.forEach((p) => p.remove()); chip.classList.remove('boom'); }, 1700);
    });
  };

  const toggleReaction = (m: Msg, x: string, wrap: HTMLElement | null) => {
    const c = cur;
    if (!c) return;
    const add = !m.mine.includes(x);
    patchChat(c.key, (cc) => ({
      ...cc,
      m: cc.m.map((y) => {
        if (y.id !== m.id) return y;
        const mine = add ? [...y.mine, x] : y.mine.filter((e) => e !== x);
        const r = add ? (y.r.includes(x) ? y.r : [...y.r, x]) : y.r.filter((e) => e !== x || (!y.mine.includes(e)));
        return { ...y, mine, r };
      }),
    }));
    setPickFor(null);
    if (!m.pending) void sv(D.react(c, m.id, x, add, meId));
    if (add) { burst(wrap, x); N.haptic('light'); }
  };

  const setMute = (c: Chat, on: boolean, dur: number) => {
    const s = { ...c.set, mute: on, muteDur: dur, muteUntil: on && MUTE_MS[dur] ? Date.now() + MUTE_MS[dur] : 0 };
    patchChat(c.key, (x) => ({ ...x, set: s }));
    void sv(D.saveChatPrefs(c, s, meId, boot?.companyId || ''));
  };
  const setChatSet = (c: Chat, patch: Partial<Chat['set']>) => {
    const s = { ...c.set, ...patch };
    patchChat(c.key, (x) => ({ ...x, set: s }));
    void sv(D.saveChatPrefs(c, s, meId, boot?.companyId || ''));
  };

  // ------------------------------------------------------------ profile/status
  const setStatus = useCallback((k: StatusKey, clearMs: number | null = null) => {
    patchPerson(meId, (p) => ({ ...p, st: k }));
    void sv(D.setStatus(k, clearMs));
    toast('Status: ' + ST[k][0]);
  }, [meId, patchPerson, sv, toast]);
  const saveMeT = useRef<number>();
  const saveMe = useCallback((p: Person) => {
    setPeople((ps) => ({ ...ps, [p.id]: p }));
    window.clearTimeout(saveMeT.current);
    saveMeT.current = window.setTimeout(() => void sv(D.updateMe({ bio: p.bio, h: p.h, days: p.days })), 700);
  }, [sv]);

  const pickCb = useRef<((f: File, u: string) => void) | null>(null);
  const pickImg = useCallback((cb: (file: File, dataUrl: string) => void) => {
    pickCb.current = cb;
    if (fiRef.current) { fiRef.current.value = ''; fiRef.current.click(); }
  }, []);
  const onFile = () => {
    const f = fiRef.current?.files?.[0];
    if (!f || !pickCb.current) return;
    const cb = pickCb.current;
    const r = new FileReader();
    r.onload = () => cb(f, String(r.result));
    r.readAsDataURL(f);
  };

  // ------------------------------------------------------------ notices
  const canDeleteNotice = (n: Notice) => n.authorId === meId || boot?.isAdmin || boot?.canPostNotices;
  const removeNotice = (n: Notice) => {
    if (!window.confirm(`Excluir o aviso “${n.title}” para todos?`)) return;
    const before = notices;
    setNotices((ns) => ns.filter((x) => x.id !== n.id));
    void D.deleteNotice(n.id).then(() => toast('Aviso excluído')).catch(() => { setNotices(before); toast('Não foi possível excluir o aviso'); });
  };
  const pinned = notices.find((n) => n.pinned) || null;
  const rest = notices.filter((n) => n !== pinned);
  const unreadNotices = notices.filter((n) => n.unread).length;
  const readNotice = (n: Notice, ack = false) => {
    if (!n.unread && (!ack || n.acked)) return;
    setNotices((ns) => ns.map((x) => (x.id === n.id ? { ...x, unread: false, acked: x.acked || ack } : x)));
    void sv(D.markNotice(n.id, ack));
  };

  // ------------------------------------------------------------ realtime + notifications
  const openFrom = useCallback((d: Record<string, string>) => {
    setPages([]); setSheetOn(false); setGs(null); setOpen(false);
    if (d?.type === 'message' && d.chatId) { setTab(1); void openRoom(d.chatId); }
    else if (d?.type === 'notice') { setRoomOn(false); setTab(2); }
    else if (d?.type === 'birthday') { setRoomOn(false); setTab(3); }
    else if (d?.type === 'meeting') { setRoomOn(false); setTab(0); }
    else if (d?.type === 'ticket') { setRoomOn(false); setTab(4); }
  }, [openRoom, setOpen]);

  const showBanner = useCallback((o: { title: string; body: string; data: Record<string, string>; av?: Chat | null }) => {
    setBan(o);
    window.clearTimeout((showBanner as unknown as { _t?: number })._t);
    (showBanner as unknown as { _t?: number })._t = window.setTimeout(() => setBan(null), 4300);
  }, []);

  useEffect(() => {
    if (!boot || !meId) return;
    N.updateContext({
      prefs: () => stateRef.current.prefs, me: () => stateRef.current.people[meId] || null, open: openFrom,
      chat: (id) => stateRef.current.chats.find((c) => c.key === id) || null, banner: showBanner,
      onToken: (t) => void D.registerDevice(t, N.isNative() ? 'android' : 'web', '1.0.0', meId, boot.companyId).catch(() => undefined),
      savePush: (sub) => D.saveWebPush(sub, meId, boot.companyId),
    });
    void N.init({
      prefs: () => stateRef.current.prefs, me: () => stateRef.current.people[meId] || null, open: openFrom,
      chat: (id) => stateRef.current.chats.find((c) => c.key === id) || null, banner: showBanner,
      onToken: (t) => void D.registerDevice(t, N.isNative() ? 'android' : 'web', '1.0.0', meId, boot.companyId).catch(() => undefined),
      savePush: (sub) => D.saveWebPush(sub, meId, boot.companyId),
    }).then(() => setPerm(N.getPermission()));
  }, [boot, meId, openFrom, showBanner]);

  // Read receipts: DMs in real time; groups refreshed while the group is open.
  useEffect(() => {
    if (!boot || !meId) return;
    return D.subscribeDmReads(meId, (row) => {
      const key = `dm:${row.receiver_id}`;
      const upto = new Date(row.created_at).getTime();
      setChats((cs) => cs.map((c) => (c.key !== key ? c : {
        ...c,
        m: c.m.map((x) => (x.me && !x.rd && new Date(x.at).getTime() <= upto ? { ...x, rd: true } : x)),
        last: c.last && c.last.me && new Date(c.last.at).getTime() <= upto ? { ...c.last, rd: true } : c.last,
      })));
    });
  }, [boot, meId]);
  useEffect(() => {
    const c = cur;
    setGroupWm(null);
    if (!roomOn || !c || c.kind !== 'group') return;
    let alive = true;
    const tick = () => { void D.groupReadWatermark(c.id).then((w) => { if (alive) setGroupWm(w); }); };
    tick();
    const t = window.setInterval(tick, 15000);
    return () => { alive = false; window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomOn, curKey]);

  // "Digitando...": same realtime broadcast channels as the desktop chat (useTypingIndicator).
  // One channel per recent conversation, so the chat list can show "digitando..." too.
  const typingChs = useRef(new Map<string, { send: (o: unknown) => unknown; close: () => void }>());
  const typingWho = useRef<Record<string, Record<string, { n: string; t: number }>>>({});
  const typingSig = chats.slice(0, 40).map((c) => c.key).sort().join(',');
  useEffect(() => {
    if (!meId) return;
    const want = new Map(stateRef.current.chats.slice(0, 40).map((c) => [c.key, c] as const));
    const live = typingChs.current;
    const sync = () => {
      const out: Record<string, string[]> = {};
      for (const [k, who] of Object.entries(typingWho.current)) { const n = Object.values(who).map((x) => x.n); if (n.length) out[k] = n; }
      setTypingMap(out);
    };
    for (const [k, ch] of live) if (!want.has(k)) { ch.close(); live.delete(k); delete typingWho.current[k]; }
    for (const [k, c] of want) {
      if (live.has(k)) continue;
      const name = c.kind === 'sector' ? `sector-${c.id}` : c.kind === 'group' ? `group-${c.id}` : `dm-${[meId, c.id].sort().join('-')}`;
      live.set(k, D.typingChannel(name, (p) => {
        if (!p?.profileId || p.profileId === meId) return;
        const who = (typingWho.current[k] ||= {});
        const t = Date.now();
        who[p.profileId] = { n: p.name || 'Alguém', t };
        sync();
        window.setTimeout(() => { if (who[p.profileId!]?.t === t) { delete who[p.profileId!]; sync(); } }, 3000);
      }));
    }
    sync();
  }, [typingSig, meId]);
  useEffect(() => () => { typingChs.current.forEach((ch) => ch.close()); typingChs.current.clear(); }, []);
  const typing = roomOn && cur && typingMap[cur.key] ? { key: cur.key, names: typingMap[cur.key] } : null;
  const sendTyping = () => {
    const now = Date.now();
    const ch = cur ? typingChs.current.get(cur.key) : null;
    if (now - typingSent.current < 2000 || !ch) return;
    typingSent.current = now;
    const me = stateRef.current.people[meId];
    ch.send({ profileId: meId, name: me?.n || 'Alguém' });
  };

  // E2E voice: re-seal keys of my voice notes for new devices of conversation members.
  useEffect(() => {
    if (!boot || !meId) return;
    return watchKeyRequests(meId, (chatKey, profileId) => {
      const c = stateRef.current.chats.find((x) => x.key === chatKey);
      return !!c && (c.mem.includes(profileId) || (c.kind === 'dm' && c.id === profileId));
    });
  }, [boot, meId]);

  useEffect(() => {
    if (!boot || !meId) return;
    const unsub = D.subscribe(boot.companyId, meId, {
      onMessage: (kind, row) => {
        const { chats: cs, people: ps, roomOn: ro, curKey: ck } = stateRef.current;
        const from: string = kind === 'sector' ? row.author_id : row.sender_id;
        if (from === meId) return;
        let key = kind === 'sector' ? `sector:${row.sector_id}` : kind === 'dm' ? `dm:${row.sender_id}` : `group:${row.group_id}`;
        let c = cs.find((x) => x.key === key);
        if (!c && kind === 'dm' && ps[row.sender_id]) {
          c = D.makeDm(ps[row.sender_id], null, 0, meId, null);
          setChats((all) => [c as Chat, ...all]);
        }
        if (!c) return;
        key = c.key;
        const m = { ...D.toMsg({ id: row.id, from, t: row.content, at: row.created_at }, meId), rp: row.reply_to_id || null };
        const isOpen = ro && ck === key && !document.hidden;
        setChats((all) => {
          const a = all.map((x) => (x.key === key ? { ...x, m: x.loaded && !x.m.some((y) => y.id === m.id) ? D.orderMsgs([...x.m, m]) : x.m, u: isOpen ? 0 : Math.min(99, x.u + 1), last: { t: m.t, at: m.at, me: false, from } } : x));
          D.sortChats(a);
          return a;
        });
        if (isOpen) { void D.markRead(c, meId).catch(() => undefined); return; }
        const who = ps[from];
        const title = c.g ? `${who?.n || 'Alguém'} · ${c.n}` : c.n;
        void N.deliver({ type: 'message', chat: c, title, body: m.t, data: { type: 'message', chatId: key } }).then((r) => {
          if (r.mode === 'banner') showBanner({ title, body: stateRef.current.prefs.prev === 0 ? 'Nova mensagem' : m.t, data: { type: 'message', chatId: key }, av: c });
        });
      },
      onReaction: (kind, row, removed) => {
        if (!row?.message_id || row.profile_id === meId) return;
        setChats((all) => all.map((c) => {
          if (!c.loaded || (kind === 'sector') !== (c.kind === 'sector')) return c;
          if (!c.m.some((m) => m.id === row.message_id)) return c;
          return { ...c, m: c.m.map((m) => (m.id !== row.message_id ? m : removed ? m : { ...m, r: m.r.includes(row.emoji) ? m.r : [...m.r, row.emoji] })) };
        }));
      },
      onNotice: (row) => {
        const body = String(row.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const n: Notice = { id: row.id, title: row.title, body, preview: body.slice(0, 80), at: row.created_at, unread: row.author_id !== meId, acked: false, pinned: !!row.is_pinned, author: stateRef.current.people[row.author_id]?.n || 'Administração', priority: row.priority || 'normal' };
        setNotices((ns) => (ns.some((x) => x.id === n.id) ? ns : [n, ...ns]));
        if (row.author_id === meId) return;
        void N.deliver({ type: 'notice', urgent: true, title: 'Aviso da administração', body: n.title, data: { type: 'notice', id: n.id } }).then((r) => {
          if (r.mode === 'banner') showBanner({ title: 'Aviso da administração', body: n.title, data: { type: 'notice', id: n.id } });
        });
      },
      onProfile: (row) => {
        setPeople((ps) => {
          const p = ps[row.id];
          if (!p) return ps;
          return { ...ps, [row.id]: { ...p, st: statusOf(row.user_status, p.st), photo: row.avatar_url ?? p.photo, cover: row.cover_url ?? p.cover, bio: row.description ?? p.bio } };
        });
      },
    });
    return unsub;
  }, [boot, meId, showBanner]);

  // Keyboard: size the app to the visual viewport so the header stays put and only
  // the messages area shrinks (WhatsApp-like), instead of the page sliding up.
  useEffect(() => {
    const vv = window.visualViewport;
    const r = rootRef.current;
    if (!vv || !r) return;
    const fit = () => {
      r.style.height = vv.height + 'px';
      r.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : '';
      if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
      const b = msgsRef.current;
      if (b && stateRef.current.roomOn) b.scrollTop = b.scrollHeight;
    };
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    fit();
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); r.style.height = ''; r.style.transform = ''; };
  }, [boot]);

  // deep link: /?chat=<key> opens that conversation once the data is loaded
  useEffect(() => {
    if (!boot) return;
    const qt = new URLSearchParams(window.location.search).get('tab');
    if (qt === 'notices') setTab(2); else if (qt === 'birthdays') setTab(3);
    const k = new URLSearchParams(window.location.search).get('chat');
    if (k && boot.chats.some((c) => c.key === k)) { setTab(1); void openRoom(k); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot]);

  // meeting reminder + birthday digest (native only for the daily one)
  useEffect(() => {
    if (!boot || perm !== 'granted') return;
    const nm = boot.dashboard.nextMeeting;
    if (nm && prefs.nr) void N.scheduleMeeting({ id: 7001, title: `${nm.title} · ${nm.room}`, at: nm.at });
    const b = boot.birthdays.today[0];
    if (b && prefs.ns) void N.scheduleDaily({ id: 7002, hour: 8, minute: 0, title: 'Aniversariantes de hoje', body: `${boot.people[b.personId]?.n} faz aniversário hoje 🎉`, channel: 'aniversarios' });
  }, [boot, perm, prefs.nr, prefs.ns]);

  const askPerm = useCallback(() => { void N.ensurePermission().then((v) => { setPerm(v); toast(v === 'granted' ? 'Notificações ativadas' : 'Permissão negada'); }); }, [toast]);

  // back button (Android / browser history)
  useEffect(() => {
    N.setBackHandler(() => {
      const r = rootRef.current;
      if (r?.dataset.tour === '1') { setTourOn(false); return true; }
      if (gsRef.current) { setGs(null); return true; }
      if (pagesRef.current.length) { setPages((s) => s.slice(0, -1)); return true; }
      if (sheetRef.current) { setSheetOn(false); return true; }
      if (attRefState.current) { setAttOn(false); return true; }
      if (stateRef.current.roomOn) { closeRoom(); return true; }
      if (openRef.current) { setOpen(false); return true; }
      if (stateRef.current.tab !== 0) { setTab(0); return true; }
      return false;
    });
    N.setResumeHandler(() => { void load(); });
  }, [closeRoom, setOpen, load]);
  const gsRef = useRef(gs); gsRef.current = gs;
  const pagesRef = useRef(pages); pagesRef.current = pages;
  const sheetRef = useRef(sheetOn); sheetRef.current = sheetOn;
  const attRefState = useRef(attOn); attRefState.current = attOn;

  // ------------------------------------------------------------ home animation
  const ringRef = useRef<SVGCircleElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const [anim, setAnim] = useState(0);
  // Início: refresh the dashboard numbers whenever the tab is opened (and every
  // minute while it stays open), without reloading the page.
  const bootReady = !!boot;
  useEffect(() => {
    if (tab !== 0 || !bootReady || !meId) return;
    let alive = true;
    const refresh = () => {
      const companyId = companyRef.current;
      if (!companyId) return;
      void D.refreshDashboard(meId, companyId, stateRef.current.chats).then((dashboard) => {
        if (!alive) return;
        // Only touch the screen when something actually changed (no second "loading" animation).
        setBoot((b) => (!b || JSON.stringify(b.dashboard) === JSON.stringify(dashboard) ? b : { ...b, dashboard, birthdays: D.computeBirthdays(stateRef.current.people) }));
      }).catch(() => undefined);
    };
    setAnim((x) => x + 1);
    refresh();
    const t = window.setInterval(refresh, 60000);
    return () => { alive = false; window.clearInterval(t); };
  }, [tab, bootReady, meId]);
  useEffect(() => {
    if (!boot) return;
    const r = ringRef.current, l = lineRef.current;
    if (!r || !l) return;
    const d = boot.dashboard;
    r.style.transition = l.style.transition = 'none';
    r.style.strokeDashoffset = '251'; l.style.strokeDashoffset = '200';
    void r.getBoundingClientRect();
    r.style.transition = 'stroke-dashoffset 1.3s cubic-bezier(.22,.9,.3,1)';
    l.style.transition = 'stroke-dashoffset 1.6s ease';
    r.style.strokeDashoffset = String(251 * (1 - d.tasksDone / Math.max(1, d.tasksTotal)));
    l.style.strokeDashoffset = '0';
  }, [anim, boot]);

  // ------------------------------------------------------------ tour
  const tourCtl = useRef<TourController | null>(null);
  tourCtl.current = {
    root: () => rootRef.current, phone: () => phoneRef.current,
    go, openFirstRoom: () => { const c = stateRef.current.chats[0]; if (c) void openRoom(c.key); }, closeRoom,
    roomOpen: () => stateRef.current.roomOn, setDrawer: setOpen, drawerOpen: () => openRef.current, tab: () => stateRef.current.tab,
    setDraft, openSheet: () => setSheetOn(true), closeSheet: () => setSheetOn(false), setSeg,
    showPick: () => { const c = stateRef.current.chats.find((x) => x.key === stateRef.current.curKey); const m = c?.m.filter((x) => !x.me).pop(); if (m) setPickFor(m.id); },
    hidePick: () => setPickFor(null), expandFirstNotice: () => { const n = rest[0]; if (n) setOpenNotice((o) => ({ ...o, [n.id]: true })); },
  };
  useEffect(() => {
    if (!tourOn) return;
    const stop = runTour(tourCtl, () => {
      setTourOn(false);
      safeStore.set(`tut:${meId}`, true);
      if (N.getPermission() === 'prompt' && !safeStore.get(`permAsked:${meId}`, false)) {
        safeStore.set(`permAsked:${meId}`, true);
        window.setTimeout(askPerm, 700);
      }
    });
    return stop;
  }, [tourOn, meId, askPerm]);
  useEffect(() => {
    if (permGate) return;
    if (boot && meId && !safeStore.get(`tut:${meId}`, false)) { const t = window.setTimeout(() => setTourOn(true), 900); return () => window.clearTimeout(t); }
  }, [boot, meId, permGate]);

  // ------------------------------------------------------------ render guards
  if (err) {
    return (
      <div className="ew ewx-root" data-theme={themeAttr}>
        <div className="ewx-fail"><p>{err}<br />Verifique sua conexão.</p><button onClick={() => void load()}>Tentar de novo</button></div>
      </div>
    );
  }
  if (!boot || !me) {
    return <EwwonLoader />;
  }

  const P = people;
  const dash = boot.dashboard;
  const totalUnread = chats.reduce((a, c) => a + c.u, 0);
  const h = new Date().getHours();
  const hello = (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite') + ', ' + me.n.split(' ')[0];
  const chart = dash.chart[seg];
  const linePath = (() => {
    const v = dash.activity, n = v.length, mx = Math.max(...v, 1);
    const pts = v.map((y, i) => [3 + (i * 114) / Math.max(1, n - 1), 52 - (y / mx) * 44]);
    let d = 'M' + pts[0][0] + ' ' + pts[0][1].toFixed(1);
    for (let i = 1; i < n; i++) { const a = pts[i - 1], b = pts[i], cx = (a[0] + b[0]) / 2; d += ` C${cx.toFixed(1)} ${a[1].toFixed(1)} ${cx.toFixed(1)} ${b[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`; }
    return d;
  })();
  const DASH: [string, number, string, string, number][] = [
    ['msg', dash.counters.msg, 'não lidas', 'chat', 1],
    ['tasks', dash.counters.tasks, 'tarefas', 'tasks', 0],
    ['meet', dash.counters.meet, 'reuniões', 'cal', 0],
    ['late', dash.counters.late, 'atrasadas', 'clock', 0],
  ];
  const bdayToday = boot.birthdays.today[0] || null;
  const bdayPerson = bdayToday ? P[bdayToday.personId] : null;
  const nx = boot.birthdays.upcoming[0];

  const filtered = chats.filter((c) => c.n.toLowerCase().includes(q.toLowerCase()) && (cfl === 'all' || (cfl === 'un' && c.u) || (cfl === 'set' && c.g) || (cfl === 'p' && !c.g)));
  const pinL = filtered.filter((c) => c.set.pin), restL = filtered.filter((c) => !c.set.pin);
  const DDL = { all: 'Todas', un: 'Não lidas', set: 'Setores e grupos', p: 'Pessoas' } as const;

  const curSys = !!cur?.p && isSystemSender(cur.p);
  const stt = (c: Chat) => (c.p && isSystemSender(c.p) ? 'Somente comunicados' : c.p ? ST[P[c.p]?.st || 'disp'][0] : `${c.mem.length} membros · ${c.mem.filter((id) => P[id] && P[id].st !== 'fora').length} presentes`);

  const row = (c: Chat) => {
    const l = c.last;
    const pre = l ? (l.me ? <><Ticks read={!!l.rd} small /> </> : c.g && l.from && P[l.from] ? P[l.from].n.split(' ')[0] + ': ' : '') : '';
    const e = c.p ? P[c.p] : null;
    return (
      <button key={c.key} className="ct" data-k={c.key}
        onClick={() => { if (ctHold.current.fired) { ctHold.current.fired = false; return; } void openRoom(c.key); }}
        onTouchStart={() => { ctHold.current.fired = false; ctHold.current.t = window.setTimeout(() => { ctHold.current.fired = true; N.haptic('light'); setCtMenu(c); }, 480); }}
        onTouchMove={() => window.clearTimeout(ctHold.current.t)} onTouchEnd={() => window.clearTimeout(ctHold.current.t)}
        onContextMenu={(e) => { e.preventDefault(); setCtMenu(c); }}>
        <Av p={e || { id: '', photo: c.photo, hue: c.hue, i: c.i }} st={e ? e.st : null} onClick={e && !e.sys ? (ev) => { ev.stopPropagation(); pgShow({ kind: 'profile', id: e.id }); } : undefined} />
        <div className="mid">
          <div className="l1"><b>{c.n}</b><span className="tmx">{l ? fmtTime(l.at) : ''}</span></div>
          <div className="l2">{typingMap[c.key] ? <p className="ewx-typing-tx">{c.kind === 'dm' ? 'digitando...' : `${typingMap[c.key].map((n) => n.split(' ')[0]).join(', ')} ${typingMap[c.key].length > 1 ? 'estão digitando...' : 'está digitando...'}`}</p> : <p>{pre}{l ? previewText(D.plainText(l.t)) : <i style={{ opacity: 0.6 }}>Sem mensagens</i>}</p>}{isMuted(c) ? <I n="mute" className="pin" /> : null}{c.u ? <span className="un">{c.u}</span> : c.set.pin ? <I n="pin" className="pin" /> : null}</div>
        </div>
      </button>
    );
  };

  const fsPx = [13.5, 14.5, 16.5][cur?.set.fs ?? 1];
  const ffCss = ['inherit', 'Georgia,serif', 'ui-monospace,Menlo,monospace'][cur?.set.ff ?? 0];
  const col = [['var(--ac)', 'var(--acx)'], ['#4f8cff', '#fff'], ['#2fbf71', '#fff'], ['#8b5cf6', '#fff']][cur?.set.col ?? 0];
  const msgsVars: React.CSSProperties & Record<string, string> = {
    ['--fs' as string]: fsPx + 'px', ['--ff' as string]: ffCss, ['--mebg' as string]: col[0], ['--mefg' as string]: col[1],
  };
  // Chat wallpaper covers the whole conversation screen (header, messages and composer).
  const roomStyle: React.CSSProperties = {
    backgroundImage: cur?.wp ? `linear-gradient(rgba(8,8,10,.55),rgba(8,8,10,.55)),url("${cur.wp}")` : ['none', 'radial-gradient(rgba(128,128,140,.28) 1px,transparent 1.2px)', 'linear-gradient(rgba(128,128,140,.1),rgba(128,128,140,.1))'][cur?.set.wall ?? 0],
    backgroundSize: cur?.wp ? 'cover' : cur?.set.wall === 1 ? '16px 16px' : 'auto', backgroundPosition: 'center',
  };

  const api: EwApi = {
    boot, people, chats, prefs, cur, me, toast, pgShow, pgBack, pgClose, gsOpen, setPrefs, patchChat, patchPerson, openDm, setStatus, saveMe,
    pickImg, setTheme: (v) => setPrefs({ ...prefs, theme: v }), perm, askPerm, tickets, setTickets, sv, reload: load, openChat: (key) => { setPages([]); setGs(null); setTab(1); window.setTimeout(() => void openRoom(key), 60); },
  };

  const top = pages[pages.length - 1];

  return (
    <>
    <div className="ew ewx-root" data-theme={themeAttr} data-rm={prefs.red ? '' : undefined} ref={rootRef} data-tour={tourOn ? '1' : undefined}>
      <div id="phone" ref={phoneRef} className={tourOn ? 'tour' : ''}>
        {permGate && boot ? <PermissionGate onDone={() => setPermGate(false)} /> : null}
        <aside id="panel" ref={panelRef}>
          <div className={'pf' + (me.photo ? ' ewx-pf-photo' : '')} style={{ ['--sc' as string]: ST[me.st][1], backgroundImage: me.photo ? `url("${me.photo}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>{me.photo ? '' : me.i}<i className="pfd" /></div>
          <h2 id="pnm">{me.n}</h2>
          <div className="u" id="phd">{me.mail ? me.mail.split('@')[0] : ''} · {me.role}</div>
          <button className="stp lq" id="stp" style={{ ['--sc' as string]: ST[me.st][1] }} onClick={() => gsOpen({ kind: 'status' })}><i /><span id="stl">{ST[me.st][0]}</span><I n="chevD" /></button>
          <div className="stats"><div><b>{boot.sectorsCount}</b>setores</div><div><b>{Math.max(0, Object.values(P).filter((p) => !p.sys).length - 1)}</b>colegas</div></div>
          <button className="mi" id="mp" onClick={() => { setOpen(false); window.setTimeout(() => pgShow({ kind: 'profile', id: meId }), 260); }}><I n="user" />Meu perfil</button>
          <button className="mi" onClick={() => setPrefs({ ...prefs, nm: prefs.nm ? 0 : 1 })}><I n="bell" />Notificações<span className={'sw' + (prefs.nm ? ' on' : '')} /></button>
          <button className="mi" onClick={() => setPrefs({ ...prefs, snd: prefs.snd ? 0 : 1 })}><I n="sound" />Som das mensagens<span className={'sw' + (prefs.snd ? ' on' : '')} /></button>
          <button className="mi" onClick={() => setPrefs({ ...prefs, theme: prefs.theme === 1 ? 0 : 1 })}><I n="moon" />Tema escuro<span className={'sw' + (prefs.theme !== 1 ? ' on' : '')} /></button>
          <div className="sep" />
          <button className="mi" id="rt" onClick={() => { setOpen(false); window.setTimeout(() => setTourOn(true), 450); }}><I n="play" />Ver tutorial</button>
          <button className="mi" id="cfg" onClick={() => { setOpen(false); window.setTimeout(() => pgShow({ kind: 'settings' }), 260); }}><I n="sliders" />Configurações</button>
          <button className="mi" id="sup" onClick={() => { setOpen(false); window.setTimeout(() => pgShow({ kind: 'support' }), 260); }}><I n="help" />Suporte</button>
          <div className="pb"><button className="mi out" onClick={() => { if (window.confirm('Sair da conta?')) void signOut(); }}><I n="logout" />Sair da conta</button></div>
        </aside>

        <div id="main" ref={mainRef}>
          <div id="scrim" ref={scrimRef} onClick={() => setOpen(false)} />
          <div className="views">
            {/* ---------------- Início ---------------- */}
            <section className={'view' + (tab === 0 ? ' on' : '')} id="v0">
              <h1 id="hi">{hello}</h1><p className="sub">Seu resumo de hoje</p>
              <div className="card" id="hero">
                <div className="stage">
                  <div id="fdw">
                    {DASH.map((d, i) => (
                      <button key={d[0] + anim} className={`fchip p${i + 1}`} style={{ ['--d' as string]: `${-i * 1.4}s` }} onClick={() => { if (d[4]) go(1); }}>
                        <i><I n={d[3]} /></i><span><b><Count to={d[1]} k={anim} /></b>{d[2]}</span>
                      </button>
                    ))}
                  </div>
                  <div className="fl"><div className="iso"><div className="ly" /><div className="ly" /><div className="ly"><i /><i /><i /></div></div></div>
                </div>
                <div className="row">
                  <div><h3>Para hoje</h3><div className="big"><span id="n8"><Count to={dash.tasksTotal} k={anim} /></span> tarefas</div></div>
                  <svg className="ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="var(--c2)" /><circle ref={ringRef} id="rg" cx="50" cy="50" r="40" stroke="var(--ac)" strokeDasharray="251" strokeDashoffset="251" transform="rotate(-90 50 50)" /></svg>
                </div>
                <div className="hs" id="hstats">
                  <div className="hc">Concluídas<b id="hsd">{dash.tasksDone} de {dash.tasksTotal}</b></div>
                  <div className="hc">Reunião<b id="hsm">{dash.nextMeeting ? dash.nextMeeting.time.slice(-5) : '—'}</b></div>
                  <div className="hc">Atrasadas<b id="hsr">{dash.late}</b></div>
                </div>
              </div>
              <div className="g2 ewx-sq">
                <div className="card" id="actcard"><h3>Atividade</h3><div className="big"><span id="n12"><Count to={dash.actions} k={anim} /></span></div><small className="ewx-sq-sub">{dash.actions === 1 ? 'mensagem enviada' : 'mensagens enviadas'}</small>
                  <svg viewBox="0 0 120 56" className="ewx-sq-line"><path ref={lineRef} id="ln" d={linePath} fill="none" stroke="var(--ac)" strokeWidth="3" strokeLinecap="round" strokeDasharray="200" strokeDashoffset="200" /></svg>
                  <div className="days"><span>7 dias</span><span>hoje</span></div></div>
                <div className="card" id="meetcard"><h3>Próxima reunião</h3><div className="big" id="nmt">{dash.nextMeeting ? dash.nextMeeting.time.slice(-5) : '—'}</div>
                  <small className="ewx-sq-sub" id="nmr">{dash.nextMeeting ? (dash.nextMeeting.time.length > 5 ? dash.nextMeeting.time.slice(0, 5) + ' · ' : 'Hoje · ') + dash.nextMeeting.room : 'Sem reuniões marcadas'}</small>
                  <small className="ewx-sq-sub ewx-sq-mu" id="nml">{dash.nextMeeting ? dash.nextMeeting.title : 'Nada na agenda'}</small>
                  <div className="hc ewx-sq-foot">faltam<b id="nmi">{dash.nextMeeting ? dash.nextMeeting.inLabel : '—'}</b></div></div>
              </div>
              <div className="card" id="chartcard">
                <div className="row"><div><h3>Tarefas concluídas</h3><div className="big" id="pc">{chart.p}</div></div>
                  <div className="seg" id="seg">{(['7', '30'] as const).map((k) => <button key={k} className={seg === k ? 'on' : ''} data-k={k} onClick={() => setSeg(k)}>{k} dias</button>)}</div></div>
                <Bars v={chart.v} k={seg + anim} />
                <div className="days" id="bl">{chart.l.map((x, i) => <span key={i}>{x}</span>)}</div>
              </div>
              <div className="g2">
                <button className="sc" onClick={() => go(1)}><span className="ic"><I n="chat" /></span><b>{totalUnread ? `${totalUnread} não ${totalUnread === 1 ? 'lida' : 'lidas'}` : 'Tudo lido'}</b><span>Abrir conversas</span></button>
                <button className="sc" onClick={() => go(3)}><span className="ic"><I n="gift" /></span><b>{bdayPerson ? `${bdayPerson.n.split(' ')[0]} faz aniversário` : nx ? `${P[nx.personId]?.n.split(' ')[0]} em ${nx.inDays}d` : 'Aniversários'}</b><span>{bdayPerson ? 'Hoje' : 'Próximo'}</span></button>
              </div>
            </section>

            {/* ---------------- Chat ---------------- */}
            <section className={'view' + (tab === 1 ? ' on' : '')} id="v1">
              <div className="sr">
                <label className="srch"><I n="search" /><input id="q" placeholder="Buscar conversa" value={q} onChange={(e) => setQ(e.target.value)} /></label>
                <div className="ddw">
                  <button className={'fb' + (ddOn ? ' op' : '')} id="fb" onClick={(e) => { e.stopPropagation(); setDdOn(!ddOn); }}><span id="fbl">{DDL[cfl]}</span><I n="chevD" /></button>
                  <div className={'dd' + (ddOn ? ' on' : '')} id="dd">
                    {(Object.keys(DDL) as (keyof typeof DDL)[]).map((k) => <button key={k} className={cfl === k ? 'on' : ''} onClick={(e) => { e.stopPropagation(); setCfl(k); setDdOn(false); }}>{DDL[k]}</button>)}
                  </div>
                </div>
              </div>
              <div id="list" onClick={() => setDdOn(false)}>
                {pinL.length ? <><div className="lb">Fixadas</div><div className="grp">{pinL.map(row)}</div></> : null}
                {restL.length ? <><div className="lb">Recentes</div><div className="grp">{restL.map(row)}</div></> : null}
                {!pinL.length && !restL.length ? <div className="hint" style={{ padding: 30 }}>Nenhuma conversa encontrada</div> : null}
                <button className="btn sec ewx-newchat" onClick={() => gsOpen({ kind: 'newchat' })}><I n="plus" />Nova conversa ou grupo</button>
              </div>
            </section>

            {/* ---------------- Avisos ---------------- */}
            <section className={'view' + (tab === 2 ? ' on' : '')} id="v2">
              {boot.canPostNotices ? <div className="ewx-notice-head"><button className="btn full" onClick={() => gsOpen({ kind: 'notice' })}><I n="plus" />Novo aviso</button></div> : null}
              <div className={'feat' + (pinned ? '' : ' hid')} id="feat" data-t="Importante" style={{ ['--c' as string]: '#ff8f80' }}>
                <I n="mega" className="bgi" />
                <div className="fh"><span className="pn"><I n="pin" />Fixado</span></div>
                <h3 id="fth">{pinned?.title}</h3><p id="ftp">{pinned?.body}</p>
                <div className="ff"><span id="ftw">{pinned ? `${pinned.author} · ${fmtTime(pinned.at)}` : ''}</span>
                  <span className="ewx-ff-acts">{pinned && canDeleteNotice(pinned) ? <button className="btn sm sec ewx-del" onClick={() => removeNotice(pinned)}><I n="trash" /></button> : null}
                  <button className="btn sm" id="ciente" onClick={() => { if (pinned) { readNotice(pinned, true); toast('Leitura confirmada'); } }}>{pinned && pinned.acked ? 'Ciente ✓' : 'Ciente'}</button></span></div>
              </div>
              <div id="avisos">
                {rest.map((a) => (
                  <div key={a.id} className={'av-i' + (a.unread ? '' : ' read') + (openNotice[a.id] ? ' open' : '')} data-id={a.id} onClick={() => { setOpenNotice((o) => ({ ...o, [a.id]: !o[a.id] })); readNotice(a); }}>
                    <div className="ah"><span className="ti"><I n="mega" /></span><div className="am"><h4>{a.title}</h4><div className="pv">{a.preview}</div></div><div className="ar"><span>{fmtTime(a.at)}</span><i className="dot" /></div></div>
                    <div className="tx"><div><p>{a.body}</p><div className="af"><span>{a.author}{a.expiresAt ? ` · expira ${new Date(a.expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''}</span>{canDeleteNotice(a) ? <button className="btn sm sec ewx-del" aria-label="Excluir aviso" onClick={(e) => { e.stopPropagation(); removeNotice(a); }}><I n="trash" /></button> : null}<button className="btn sm lido" onClick={(e) => { e.stopPropagation(); readNotice(a); toast('Aviso marcado como lido'); }}>{a.unread ? 'Marcar como lido' : 'Lido ✓'}</button></div></div></div>
                  </div>
                ))}
                {!notices.length ? <div className="hint" style={{ padding: 40 }}>Nenhum aviso por enquanto</div> : null}
              </div>
            </section>

            {/* ---------------- Aniversários ---------------- */}
            <section className={'view' + (tab === 3 ? ' on' : '')} id="v3">
              <div className={'hb' + (bdayPerson ? '' : ' hid')} id="hb" ref={hbRef}>
                <div className="hbt">
                  <div><span className="hoje">Hoje</span>
                    <div className="who">{bdayPerson ? <Av p={bdayPerson} cls="xl" st={bdayPerson.st} /> : null}<div><b id="hbn">{bdayPerson?.n}</b><small id="hbs">{bdayPerson ? bdayPerson.dept + (bdayToday?.age ? ` · ${bdayToday.age} anos` : '') : ''}</small></div></div></div>
                  <div className="cs"><div className="cube"><i>🎂</i><i>🎉</i><i>🎁</i><i>🥳</i><i>🎈</i><i>✨</i></div></div>
                </div>
                <div className="ql">Escolha a mensagem</div>
                <div className="chips" id="qc">{WISHES.map((w) => <button key={w} className={bmsg === w ? 'on' : ''} onClick={() => setBmsg(w)}>{w}</button>)}</div>
                {bdayPerson && bdayPerson.id !== meId ? (
                  <button className={'btn full' + (bdSent[bdayPerson.id] ? ' done' : '')} id="bd" onClick={() => {
                    if (!bdayPerson || bdSent[bdayPerson.id]) return;
                    setBdSent((s) => ({ ...s, [bdayPerson.id]: true }));
                    const hb = hbRef.current, cols = ['#fff', '#ffd36b', '#ff7b9c', '#7bd3ff', '#9d8cff'];
                    if (hb && !prefs.red) for (let i = 0; i < 30; i++) { const c = document.createElement('i'); c.className = 'cf'; c.style.cssText = `background:${cols[i % 5]};--x:${(Math.random() - 0.5) * 340}px;--y:${-80 - Math.random() * 240}px;--r:${Math.random() * 720}deg;animation-delay:${Math.random() * 0.2}s`; hb.appendChild(c); window.setTimeout(() => c.remove(), 1500); }
                    void sv(D.sendWishes(meId, boot.companyId, bdayPerson.id, bmsg)).then((r) => {
                      if (!r) { setBdSent((s) => ({ ...s, [bdayPerson.id]: false })); return; }
                      const key = `dm:${bdayPerson.id}`;
                      setChats((cs) => { const exists = cs.some((c) => c.key === key); const a = exists ? cs : [D.makeDm(bdayPerson, null, 0, meId, null), ...cs]; return a.map((c) => (c.key === key ? { ...c, last: { t: bmsg, at: r.at, me: true, from: meId }, m: c.loaded ? [...c.m, D.toMsg({ id: r.id, from: meId, t: bmsg, at: r.at }, meId)] : c.m } : c)); });
                      toast('Parabéns enviado para ' + bdayPerson.n.split(' ')[0]);
                    });
                  }}>{bdSent[bdayPerson.id] ? <><I n="check" />Parabéns enviado</> : <><I n="send" />Enviar parabéns</>}</button>
                ) : bdayPerson ? <div className="hint">Feliz aniversário! 🎉</div> : null}
              </div>
              <div className="g2 mn">
                <div className="mini"><b id="bmc">{boot.birthdays.month.count}</b><span id="bml">aniversários em {boot.birthdays.month.label}</span></div>
                <div className="mini"><b id="bnd">{nx ? `${nx.inDays} ${nx.inDays === 1 ? 'dia' : 'dias'}` : '—'}</b><span id="bnl">{nx ? 'até o próximo, ' + (P[nx.personId]?.n.split(' ')[0] || '') : 'sem próximos'}</span></div>
              </div>
              <div className="lb">Próximos</div>
              <div className="grp" id="nxg">
                {boot.birthdays.upcoming.map((b) => {
                  const p = P[b.personId];
                  if (!p) return null;
                  return (
                    <div className="nx" key={b.personId} onClick={() => pgShow({ kind: 'profile', id: p.id })}>
                      <div className="dt"><b>{b.day}</b><span>{b.mon}</span></div>
                      <div className="nm"><b>{p.n}</b><small>{p.dept}{b.age ? ` · ${b.age} anos` : ''}</small></div>
                      <span className="d">em {b.inDays} {b.inDays === 1 ? 'dia' : 'dias'}</span>
                      <button className={'rm' + (reminders[b.personId] ? ' on' : '')} aria-label="Lembrar" onClick={(e) => {
                        e.stopPropagation();
                        const nr = { ...reminders, [b.personId]: !reminders[b.personId] };
                        setReminders(nr); safeStore.set('bdayReminders', nr);
                        if (nr[b.personId]) { const at = new Date(); at.setDate(at.getDate() + b.inDays); at.setHours(9, 0, 0, 0); void N.scheduleMeeting({ id: 8000 + (parseInt(b.personId.slice(0, 6), 16) % 1000), title: `Aniversário de ${p.n}`, at: at.toISOString(), minutesBefore: 0 }); }
                        toast(nr[b.personId] ? 'Lembrete criado' : 'Lembrete removido');
                      }}><I n="bell" /></button>
                    </div>
                  );
                })}
                {!boot.birthdays.upcoming.length ? <div className="hint" style={{ padding: 24 }}>Nenhuma data de aniversário cadastrada</div> : null}
              </div>
            </section>

            {boot.supportStaff ? (
              <section className={'view' + (tab === 4 ? ' on' : '')} id="v4">
                <TicketsDesk meId={meId} toast={toast} active={tab === 4} onCount={setDeskCount} onChat={(t) => pgShow({ kind: 'ticket', id: t.id, label: t.label, staff: true, title: t.description.slice(0, 60) })} />
              </section>
            ) : null}
          </div>

          <nav className="tabs" id="tabs" style={boot.supportStaff ? { gridTemplateColumns: 'repeat(5,1fr)' } : undefined}>
            {[['home', 'Início'], ['chat', 'Chat'], ['bell', 'Avisos'], ['gift', 'Aniversários'], ...(boot.supportStaff ? [['ticket', 'Tickets']] : [])].map(([icon, label], i) => (
              <button key={label} className={'tab' + (tab === i ? ' on' : '')} data-i={i} onClick={() => go(i)}>
                <I n={icon} />{label}
                {i === 1 && totalUnread ? <span className="bd" id="bg" style={{ display: 'grid' }}>{totalUnread > 99 ? '99+' : totalUnread}</span> : null}
                {i === 2 && unreadNotices ? <span className="bd" id="bga" style={{ display: 'grid' }}>{unreadNotices}</span> : null}
                {i === 4 && deskCount ? <span className="bd" style={{ display: 'grid' }}>{deskCount > 99 ? '99+' : deskCount}</span> : null}
              </button>
            ))}
          </nav>

          {/* ---------------- Sala de conversa ---------------- */}
          <div id="room" className={(roomOn ? 'on' : '') + (cur && (cur.wp || cur.set.wall) ? ' ewx-wp' : '') + (curSys ? ' ewx-sys' : '')} style={roomStyle}>
            <div className="rh">
              <button id="back" aria-label="Voltar" onClick={closeRoom}><I n="chevL" /></button>
              {cur && curSys ? <div className="av ewx-sysav" id="rav"><CosmicBlob size={38} /></div> : cur ? <div className={'av' + (cur.p ? ' on' : '')} id="rav" style={{ ...avStyle(cur.p ? P[cur.p] : cur), ['--sc' as string]: cur.p ? ST[P[cur.p]?.st || 'disp'][1] : '#46d37b' }} onClick={() => (cur.p ? pgShow({ kind: 'profile', id: cur.p }) : setSheetOn(true))}>{(cur.p ? P[cur.p]?.photo : cur.photo) ? '' : cur.i}</div> : <div className="av" id="rav" />}
              <div className="rt" onClick={() => cur && !curSys && (cur.p ? pgShow({ kind: 'profile', id: cur.p }) : setSheetOn(true))}><b id="rn">{cur?.n}</b><small id="rs" className={typing && cur && typing.key === cur.key ? 'ewx-typing-tx' : undefined}>{typing && cur && typing.key === cur.key ? (cur.kind === 'dm' ? 'Digitando...' : `${typing.names.map((n) => n.split(' ')[0]).join(', ')} ${typing.names.length > 1 ? 'estão digitando...' : 'está digitando...'}`) : cur ? stt(cur) : ''}</small></div>
              {curSys
                ? <button className="lq" id="gear" aria-label="Pesquisar nesta conversa" onClick={(e) => { e.stopPropagation(); setDots(false); setSearch((x) => (x ? null : { q: '', i: 0 })); }}><I n="search" /></button>
                : <button className="lq" id="gear" aria-label="Mais opções" onClick={(e) => { e.stopPropagation(); setDots((v) => !v); }}><I n="dots" /></button>}
            </div>
              {dots ? (
                <div className="ewx-dots" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setDots(false); setSearch({ q: '', i: 0 }); }}><I n="search" />Pesquisar</button>
                  <button onClick={() => { setDots(false); setSheetOn(true); }}><I n="gear" />Configurações</button>
                </div>
              ) : null}
            {search ? (
              <div className="ewx-search">
                <I n="search" />
                <input autoFocus placeholder="Pesquisar nesta conversa" value={search.q} onChange={(e) => setSearch({ q: e.target.value, i: 0 })} />
                <span className="ewx-search-n">{search.q.trim() ? (hits.length ? `${Math.min(search.i + 1, hits.length)} de ${hits.length}` : '0') : ''}</span>
                <button aria-label="Anterior" disabled={!hits.length} onClick={() => setSearch((x) => x && ({ ...x, i: (x.i + 1) % hits.length }))}><I n="chevD" style={{ transform: 'rotate(180deg)' }} /></button>
                <button aria-label="Próximo" disabled={!hits.length} onClick={() => setSearch((x) => x && ({ ...x, i: (x.i - 1 + hits.length) % hits.length }))}><I n="chevD" /></button>
                <button aria-label="Fechar pesquisa" onClick={() => setSearch(null)}><I n="x" /></button>
              </div>
            ) : null}
            {dayFloat ? <div className="ewx-dfloat">{dayFloat}</div> : null}
            <div id="msgs" ref={msgsRef} style={msgsVars} onClick={() => { setPickFor(null); setDots(false); }} onScroll={onMsgsScroll}>
              <div className="hint">Segure ou toque 2x numa mensagem para reagir</div>
              {cur && !cur.loaded && !cur.m.length ? (
                <div className="ewx-skel" aria-label="Carregando mensagens" role="status">
                  {[62, 44, 70, 38, 56, 48].map((w, i) => <div key={i} className={'ewx-skel-b' + (i % 3 === 2 ? ' me' : '')} style={{ width: w + '%', animationDelay: i * 0.08 + 's' }} />)}
                </div>
              ) : null}
              {cur && cur.loaded && !cur.m.length ? <div className="hint" style={{ padding: 20 }}>Nenhuma mensagem ainda. Diga oi! 👋</div> : null}
              {cur ? (() => {
                // Consecutive stickers from the same person sit side by side (WhatsApp-like).
                const quoteOf = (m: Msg) => {
                  if (!m.rp) return null;
                  const q = cur.m.find((x) => x.id === m.rp);
                  const from = q ? (q.me ? meId : q.from) : m.rq?.from ?? null;
                  const t = q ? q.t : m.rq?.t;
                  if (t === undefined) return { id: m.rp, n: '', t: 'Mensagem original indisponível' };
                  return { id: m.rp, n: from === meId ? 'Você' : (from && P[from]?.n) || 'Alguém', t };
                };
                const bubble = (m: Msg, cont = false) => <Bubble key={m.id} m={m} quote={quoteOf(m)} onQuote={jumpToMsg} onReply={curSys ? undefined : () => startReply(m)} read={m.me && (!!m.rd || (cur.kind === 'group' && !!groupWm && new Date(m.at).getTime() <= groupWm))} sender={m.from ? P[m.from] : null} group={cur.g && !cont} picking={pickFor === m.id} onPick={() => setPickFor(m.id)} onReact={(x, wrap) => toggleReaction(m, x, wrap)} onProfile={(id) => pgShow({ kind: 'profile', id })} onImage={(src, url, name, caption) => setViewer({ src, url, name, caption })} />;
                const out: JSX.Element[] = [];
                const ms = cur.m;
                for (let idx = 0; idx < ms.length; idx++) {
                  const m = ms[idx];
                  if (idx === 0 || dayKey(ms[idx - 1].at) !== dayKey(m.at)) out.push(<div key={'d' + m.id} className="ewx-dsep" data-day={dayLabel(m.at)}><span>{dayLabel(m.at)}</span></div>);
                  let end = idx;
                  if (isSticker(m.t)) while (end + 1 < ms.length && isSticker(ms[end + 1].t) && ms[end + 1].me === m.me && ms[end + 1].from === m.from && dayKey(ms[end + 1].at) === dayKey(m.at)) end++;
                  if (end === idx) { out.push(bubble(m)); continue; }
                  out.push(<div key={'s' + m.id} className={'ewx-stkrow' + (m.me ? ' me' : '')}>{ms.slice(idx, end + 1).map((x, k) => bubble(x, k > 0))}</div>);
                  idx = end;
                }
                return out;
              })() : null}
              {typing && cur && typing.key === cur.key ? <div className="m ewx-typing" aria-label="Digitando"><div className="bub"><span /><span /><span /></div></div> : null}
              {far ? <div className="ewx-down-w"><button className="ewx-down" aria-label="Ir para a última mensagem" onClick={(e) => { e.stopPropagation(); jumpToEnd(); }}><I n="chevD" />{newBelow ? <span className="ewx-down-n">{newBelow > 99 ? '99+' : newBelow}</span> : null}</button></div> : null}
            </div>
            {pending.length ? (
              <div className="ewx-tray">
                {pending.map((f, i) => (
                  <div key={i} className={'ewx-tray-it' + (f.image ? ' img' : '')}>
                    {f.image && f.url ? <img src={f.url} alt="" /> : <><span className="ewx-file-ic" style={{ background: '#6b7280' }}>{(f.name.split('.').pop() || 'ARQ').slice(0, 4).toUpperCase()}</span><span className="ewx-tray-n">{f.name}<small>{(f.size / 1024 / 1024).toFixed(1)} MB</small></span></>}
                    <button aria-label="Remover" onClick={() => setPending((p) => p.filter((_, j) => j !== i))}><I n="x" /></button>
                  </div>
                ))}
              </div>
            ) : null}
            {attOn === 'menu' ? (
              <div className="ewx-att">
                <button onClick={() => setAttOn('emoji')}><span style={{ background: '#ffb020' }}>😊</span>Emoji</button>
                <button onClick={() => pickAttach('image/*')}><span style={{ background: '#8b5cf6' }}><I n="camera" /></span>Galeria</button>
                <button onClick={() => pickAttach('image/*', true)}><span style={{ background: '#ff5d7a' }}><I n="camera" /></span>Câmera</button>
                <button onClick={() => pickAttach('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,image/*')}><span style={{ background: '#4f8cff' }}><I n="upload" /></span>Arquivo</button>
                {cur && tasksOn[cur.key]?.enabled ? <>
                  <button onClick={() => { setAttOn(false); gsOpen({ kind: 'tasks', mode: 0 }); }}><span style={{ background: '#2fbf71' }}><I n="tasks" /></span>Nova tarefa</button>
                  <button onClick={() => { setAttOn(false); gsOpen({ kind: 'tasks', mode: 1 }); }}><span style={{ background: '#14b8a6' }}><I n="chevR" /></span>Mover tarefa</button>
                </> : null}
              </div>
            ) : attOn === 'sticker' ? (
              <div className="ewx-stkp"><StickerPicker notify={toast} onPick={(st) => { setAttOn(false); void send(stickerContent(st)); }} onSendContent={(c) => { setAttOn(false); void send(c); }} /></div>
            ) : attOn === 'emoji' ? (
              <div className="ewx-emo">{EMOJIS.map((e) => <button key={e} onClick={() => setDraft((d) => d + e)}>{e}</button>)}</div>
            ) : null}
            {reply && !voiceRec.recording && !recUi ? (
              <div className="ewx-reply">
                <div className="ewx-reply-q"><b>{reply.me ? 'Você' : (reply.from && P[reply.from]?.n) || 'Alguém'}</b><span>{previewText(reply.t)}</span></div>
                <button aria-label="Cancelar resposta" onClick={cancelReply}><I n="x" /></button>
              </div>
            ) : null}
            {(() => {
              if (curSys) return <><div className="ewx-sysfoot" aria-hidden="true"><CosmicBlob size={96} talk /></div><div className="ewx-ro">Este canal só envia comunicados. Não é possível responder.</div></>;
              const recOn = voiceRec.recording || !!recUi;
              const lockMode = recUi?.mode === 'lock' || (voiceRec.recording && !recUi);
              const micMode = !draft.trim() && !pending.length && !sending;
              return (
                <div className={'cmp' + (recOn ? ' ewx-rec' : '') + (recUi?.mode === 'hold' ? ' hold' : '')}>
                  {recOn ? [
                    lockMode ? <button key="rx" className="ewx-rec-x" aria-label="Cancelar áudio" onClick={() => { voiceRec.cancel(); micG.current = null; setRecUi(null); }}><I n="trash" /></button> : null,
                    <span key="rd" className="ewx-rec-dot" />,
                    <span key="rt" className="ewx-rec-t">{fmtDuration(voiceRec.seconds)}</span>,
                    lockMode
                      ? <span key="rh" className="ewx-rec-hint"><Lock /> Gravando · criptografado</span>
                      : <span key="rs" className="ewx-rec-slide" style={{ transform: `translateX(${Math.max(-110, recUi?.dx || 0)}px)`, opacity: 1 - Math.min(1, -(recUi?.dx || 0) / 140) }}><I n="chevL" />Deslize para cancelar</span>,
                  ] : [
                    <button key="plus" className={'plus' + (attOn && attOn !== 'sticker' ? ' on' : '')} aria-label="Anexar" onClick={() => setAttOn(attOn && attOn !== 'sticker' ? false : 'menu')}><I n={attOn && attOn !== 'sticker' ? 'x' : 'plus'} /></button>,
                    <button key="stk" className={'ewx-stkbtn' + (attOn === 'sticker' ? ' on' : '')} aria-label="Figurinhas" onClick={() => setAttOn(attOn === 'sticker' ? false : 'sticker')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h7l7-7V7a4 4 0 0 0-4-4h-3" /><path d="M14 21v-3a4 4 0 0 1 4-4h3" /><path d="M8.5 10h.01M15.5 10h.01M8.5 14.5c1.8 1.6 5.2 1.6 7 0" /></svg></button>,
                    <textarea key="inp" id="inp" ref={inpRef} rows={1} name="ew-message" placeholder={pending.length ? 'Adicione uma legenda' : 'Escreva uma mensagem'} autoComplete="off" autoCorrect="on" autoCapitalize="sentences" spellCheck enterKeyHint={prefs.enter !== 0 ? 'send' : 'enter'} value={draft} maxLength={4000}
                      onFocus={() => setAttOn((a) => (a === 'menu' ? false : a))}
                      onChange={(e) => { setDraft(e.target.value); fitTextarea(e.target); sendTyping(); }} onKeyDown={(e) => { if (e.key === 'Enter' && (prefs.enter !== 0 || e.ctrlKey) && !e.shiftKey) { e.preventDefault(); void doSend(); } }} />,
                  ]}
                  {recOn && lockMode
                    ? <button key="sndL" className="snd" id="snd" aria-label="Enviar áudio" onClick={() => void sendVoiceNote()}><I n="send" /></button>
                    : recOn || micMode
                      ? <button key="snd" className={'snd ewx-mic' + (recOn ? ' rec' : '')} id="snd" aria-label="Segure para gravar áudio"
                          style={recUi?.mode === 'hold' ? { transform: `translate(${Math.max(-110, recUi.dx)}px, ${Math.max(-80, recUi.dy)}px) scale(1.35)` } : undefined}
                          onPointerDown={micDown} onPointerMove={micMove} onPointerUp={micUp} onPointerCancel={micUp} onContextMenu={(e) => e.preventDefault()}>
                          <I n="mic" />
                          {recUi?.mode === 'hold' ? <span className="ewx-rec-lock" style={{ transform: `translateY(${Math.max(-40, recUi.dy / 2)}px)` }} aria-hidden="true"><Lock /><I n="chevD" style={{ transform: 'rotate(180deg)' }} /></span> : null}
                        </button>
                      : <button key="snd" className="snd" id="snd" aria-label="Enviar" disabled={sending} onClick={() => void doSend()}>{sending ? <span className="ewx-spin" /> : <I n="send" />}</button>}
                  <input key="att" ref={attRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
                </div>
              );
            })()}
            <div className={'shs' + (sheetOn ? ' on' : '')} id="shs" onClick={() => setSheetOn(false)} />
            <div className={'sheet' + (sheetOn ? ' on' : '')} id="sheet">
              {cur && sheetOn ? <ChatSheet c={cur} api={api} P={P} tasks={tasksOn[cur.key]} onTasks={(v) => {
                setTasksOn((t) => ({ ...t, [cur.key]: { enabled: v, manage: true } }));
                void sv(CT.setTasksEnabled(chatKeyFor(cur), v, boot.companyId).then(() => true)).then((ok) => { if (ok === undefined) setTasksOn((t) => ({ ...t, [cur.key]: { enabled: !v, manage: true } })); });
                toast(v ? 'Tarefas pelo chat ativadas' : 'Tarefas pelo chat desativadas');
              }} isMuted={isMuted(cur)} onMute={(on, dur) => { setMute(cur, on, dur); toast(on ? 'Conversa silenciada' : 'Notificações reativadas'); }} onSet={(patch) => setChatSet(cur, patch)} onClose={() => setSheetOn(false)} /> : null}
            </div>
          </div>
          <div id="toast" className={toastOn ? 'on' : ''}>{toastTxt}</div>
          <ImageViewer media={viewer} onClose={() => setViewer(null)} />
        </div>

        {/* ---------------- Páginas ---------------- */}
        <div id="pg" className={(pages.length ? 'on' : '') + (top && (top.kind === 'profile' || top.kind === 'groupEdit') ? ' cv' : '') + (top?.kind === 'ticket' ? ' tk' : '')}>
          <div className="pgh"><button className="lq pgb" id="pgb" aria-label="Voltar" onClick={pgBack}><I n="chevL" /></button><b id="pgt">{top ? pageTitle(top) : ''}</b><span style={{ minWidth: 38 }} /></div>
          <div className="pgc" id="pgc" key={pages.length + (top?.kind || '')}>{top ? <EwwonPage spec={top} api={api} /> : null}</div>
        </div>

        {ctMenu ? (
          <div className="ewx-ctm-bg" onClick={() => setCtMenu(null)}>
            <div className="ewx-ctm" onClick={(e) => e.stopPropagation()}>
              <div className="ewx-ctm-h"><Av p={ctMenu.p ? P[ctMenu.p] : { id: '', photo: ctMenu.photo, hue: ctMenu.hue, i: ctMenu.i }} st={null} /><div><b>{ctMenu.n}</b><small>{ctMenu.kind === 'dm' ? 'Conversa' : ctMenu.kind === 'group' ? 'Grupo' : 'Setor'}</small></div></div>
              <button onClick={() => { const c = ctMenu; setCtMenu(null); if (c.kind === 'dm' && c.p) { if (!isSystemSender(c.p)) pgShow({ kind: 'profile', id: c.p }); } else { void openRoom(c.key); window.setTimeout(() => setSheetOn(true), 350); } }}><I n="info" />{ctMenu.kind === 'dm' ? 'Ver detalhes do contato' : ctMenu.kind === 'group' ? 'Ver detalhes do grupo' : 'Ver detalhes do setor'}</button>
              <button onClick={() => { const c = ctMenu; setCtMenu(null); setChatSet(c, { pin: !c.set.pin }); setChats((cs) => { const a2 = [...cs]; D.sortChats(a2); return a2; }); toast(c.set.pin ? 'Conversa desafixada' : 'Conversa fixada no topo'); }}><I n="pin" />{ctMenu.set.pin ? 'Desafixar conversa' : 'Fixar conversa'}</button>
              {ctMenu.u ? <button onClick={() => { const c = ctMenu; setCtMenu(null); patchChat(c.key, (x) => ({ ...x, u: 0 })); void sv(D.markRead(c, meId)); }}><I n="check" />Marcar como lida</button> : null}
              <button className="ewx-ctm-x" onClick={() => setCtMenu(null)}>Cancelar</button>
            </div>
          </div>
        ) : null}

        {/* ---------------- Sheet global ---------------- */}
        <div className={'gss' + (gs ? ' on' : '')} id="gss" onClick={gsClose} />
        <div className={'sheet gs' + (gs ? ' on' : '')} id="gs">
          {gs && gs.kind === 'tasks' ? <TasksSheet mode={gs.mode} meId={meId} people={P} toast={toast} post={(t) => void send(t)} close={gsClose} />
            : gs ? <GlobalSheet spec={gs} api={api} close={gsClose} statusClear={statusClear} setStatusClear={setStatusClear} /> : null}
        </div>
        <input type="file" id="fi" ref={fiRef} accept="image/*" hidden onChange={onFile} />
        <div id="ban" className={'ban' + (ban ? ' on' : '')} onClick={() => { if (ban) { setBan(null); openFrom(ban.data); } }}>
          {ban?.av ? <Av p={ban.av.p ? P[ban.av.p] : { photo: ban.av.photo, hue: ban.av.hue, i: ban.av.i }} /> : null}
          <div><b>{ban?.title}</b><small>{ban?.body}</small></div>
        </div>
        <div id="tut" className={tourOn ? '' : 'off'}>
          <div id="sp" className="nt" /><div id="fg" />
          <div id="tc" className="hide">
            <div className="tp"><i id="tpb" /></div><small id="tn" />
            <img className="lg" id="tlg" src="/ewwon/img/logo-mark.png" alt="" />
            <h3 id="tt" /><p id="td" />
            <div className="ta"><button id="tskip">Pular tour</button><span><button className="btn sec" id="tback">Voltar</button><button className="btn" id="tnext">Próximo</button></span></div>
          </div>
        </div>
      </div>

    </div>
    </>
  );
}

function statusOf(v: string | null | undefined, fallback: StatusKey): StatusKey {
  if (!v) return fallback;
  const m: Record<string, StatusKey> = { available: 'disp', meeting: 'reun', lunch: 'almo', busy: 'ocup', leave: 'ocup', away: 'fora', offline: 'fora', vacation: 'fora', working: 'disp' };
  return m[v] || fallback;
}

function mergeMsgs(loaded: Msg[], local: Msg[]): Msg[] {
  const ids = new Set(loaded.map((m) => m.id));
  return D.orderMsgs([...loaded, ...local.filter((m) => !ids.has(m.id))]);
}

export function pageTitle(p: PageSpec): string {
  switch (p.kind) {
    case 'members': return 'Membros';
    case 'summary': return 'Resumo diário';
    case 'settings': return 'Configurações';
    case 'muted': return 'Conversas silenciadas';
    case 'support': return 'Suporte';
    case 'ticket': return 'Conversa do chamado';
    case 'eval': return 'Avaliação';
    default: return '';
  }
}

function Count({ to, k }: { to: number; k: number | string }) {
  const [v, setV] = useState(0);
  const shown = useRef(0);
  const lastK = useRef<number | string | null>(null);
  useEffect(() => {
    // New visit to the tab: count up from zero. Data refresh: glide from the current value.
    const from = lastK.current !== k ? 0 : shown.current;
    lastK.current = k;
    if (from === to) { setV(to); shown.current = to; return; }
    let s: number | null = null, raf = 0;
    const f = (t: number) => { s = s ?? t; const p = Math.min(1, (t - s) / 900); const val = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); shown.current = val; setV(val); if (p < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [to, k]);
  return <>{v}</>;
}

function Bars({ v, k }: { v: number[]; k: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bars = [...el.querySelectorAll('i')] as HTMLElement[];
    bars.forEach((b) => { b.style.transition = 'none'; b.style.transform = 'scaleY(0)'; });
    void el.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => bars.forEach((b, i) => { b.style.transition = ''; b.style.transitionDelay = i * 0.05 + 's'; b.style.transform = `scaleY(${v[i] / 100})`; })));
  }, [v, k]);
  return <div className="bars ewx-chart" id="bars" ref={ref}>{v.map((_, i) => <i key={i} />)}</div>;
}

/** Sent / delivered (white) / read (blue) marks, WhatsApp-like. */
function Ticks({ pending, read, small }: { pending?: boolean; read?: boolean; small?: boolean }) {
  return (
    <span className={'ck' + (pending ? ' one' : '') + (read ? ' rd' : '') + (small ? ' sm' : '')} aria-label={pending ? 'Enviando' : read ? 'Visualizada' : 'Entregue'}>
      <svg viewBox="0 0 18 11" aria-hidden="true"><path d="M1 5.8l3.2 3.2L10.6 2.4" />{pending ? null : <path d="M7.4 9l6.6-6.6" />}</svg>
    </span>
  );
}

function Bubble({ m, sender, group, picking, onPick, onReact, onProfile, onImage, read, quote, onQuote, onReply }: {
  quote?: { id: string; n: string; t: string } | null; onQuote?: (id: string) => void; onReply?: () => void;
  read?: boolean; m: Msg; sender: Person | null; group: boolean; picking: boolean; onPick: () => void; onReact: (x: string, wrap: HTMLElement | null) => void; onProfile: (id: string) => void; onImage: (src: string, url: string, name: string, caption?: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tm = useRef<number>();
  const [moreRx, setMoreRx] = useState(false);
  const gm = !m.me && !!sender && group;
  // Keep the reaction picker inside the screen (stickers side by side sit near the edges).
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(':scope > .pick');
    if (!el) return;
    el.style.translate = '';
    const r = el.getBoundingClientRect();
    const box = el.closest('#msgs')?.getBoundingClientRect();
    const lo = (box?.left ?? 0) + 8, hi = (box?.right ?? window.innerWidth) - 8;
    const shift = r.left < lo ? lo - r.left : r.right > hi ? hi - r.right : 0;
    if (shift) el.style.translate = `${Math.round(shift)}px 0`;
  }, [picking, moreRx]);
  const start = () => { tm.current = window.setTimeout(onPick, 450); };
  const stop = () => window.clearTimeout(tm.current);
  // Swipe right to reply: the message follows the finger (max 72px) and a reply arrow fades in.
  const sw = useRef<{ x: number; y: number; dx: number; on: boolean; dead: boolean } | null>(null);
  const [dx, setDx] = useState(0);
  const swStart = (e: React.TouchEvent) => { const t = e.touches[0]; sw.current = { x: t.clientX, y: t.clientY, dx: 0, on: false, dead: false }; };
  const swMove = (e: React.TouchEvent) => {
    const g = sw.current; if (!g || g.dead || !onReply) return;
    const t = e.touches[0]; const ddx = t.clientX - g.x, ddy = t.clientY - g.y;
    if (!g.on) { if (Math.abs(ddy) > 10 && Math.abs(ddy) > Math.abs(ddx)) { g.dead = true; return; } if (ddx > 12 && ddx > Math.abs(ddy) * 1.3) g.on = true; else return; }
    const v = Math.max(0, Math.min(72, ddx - 12));
    if (v >= 56 && g.dx < 56) N.haptic('light');
    g.dx = v; setDx(v);
  };
  const swEnd = () => { const g = sw.current; sw.current = null; if (g?.on && g.dx >= 56) onReply?.(); setDx(0); };
  const rx = m.r.length ? <div className="rx" style={{ display: 'flex' }}>{m.r.map((e) => <span key={e} onClick={(ev) => { ev.stopPropagation(); onReact(e, ref.current); }}>{e}</span>)}</div> : <div className="rx" style={{ display: 'none' }} />;
  const tmh = <div className="tm">{m.h}{m.me ? <> · <Ticks pending={m.pending} read={read} /></> : null}</div>;
  const stk = parseSticker(m.t);
  const bub = stk ? <div className="ewx-stkb" onTouchStart={start} onTouchEnd={stop} onTouchMove={stop} onMouseDown={start} onMouseUp={stop} onMouseLeave={stop} onDoubleClick={onPick} onContextMenu={(e) => { e.preventDefault(); onPick(); }}><StickerMessage sticker={stk} mine={m.me} /></div>
    : <div className="bub" onTouchStart={start} onTouchEnd={stop} onTouchMove={stop} onMouseDown={start} onMouseUp={stop} onMouseLeave={stop} onDoubleClick={onPick} onContextMenu={(e) => { e.preventDefault(); onPick(); }}><MsgBody content={m.t} onOpenImage={onImage} /></div>;
  const qb = quote ? <button type="button" className="ewx-quote" onClick={(e) => { e.stopPropagation(); onQuote?.(quote.id); }}><b>{quote.n}</b><span>{previewText(quote.t)}</span></button> : null;
  return (
    <div className={'m' + (m.me ? ' me' : '') + (gm ? ' gm' : '') + (dx ? ' ewx-sw' : '')} ref={ref} data-mid={m.id}
      style={{ animation: 'none', transform: dx ? `translateX(${dx}px)` : undefined }}
      onTouchStart={swStart} onTouchMove={swMove} onTouchEnd={swEnd} onTouchCancel={swEnd}>
      {dx ? <span className="ewx-sw-ic" style={{ opacity: Math.min(1, dx / 56), transform: `scale(${0.6 + Math.min(1, dx / 56) * 0.4})` }}><I n="reply" /></span> : null}
      {gm && sender ? (
        <>
          {sender.sys ? <div className="gav ewx-sysav"><CosmicBlob size={30} /></div> : <div className="gav" style={avStyle(sender)} onClick={() => onProfile(sender.id)}>{sender.photo ? '' : sender.i}</div>}
          <div className="gb"><div className="sn">{sender.n}</div>{qb}{bub}{rx}{tmh}</div>
        </>
      ) : <>{qb}{bub}{rx}{tmh}</>}
      {picking ? <div className="pick" onClick={(e) => e.stopPropagation()}>{REACTIONS.map((e) => <button key={e} onClick={(ev) => { ev.stopPropagation(); onReact(e, ref.current); }}>{e}</button>)}<button className="ewx-more-rx" aria-label="Mais reações" onClick={(ev) => { ev.stopPropagation(); setMoreRx((v) => !v); }}>{moreRx ? '×' : '+'}</button>{stk && stk.kind === 'img' && !m.me ? <button className="ewx-stk-save" aria-label="Salvar figurinha" onClick={(ev) => { ev.stopPropagation(); void addFavorite(stk).then(() => window.dispatchEvent(new CustomEvent('ew:toast', { detail: 'Figurinha salva em Minhas' }))).catch(() => undefined); }}>⭐</button> : null}{moreRx ? <div className="ewx-rx-all">{EMOJIS.map((e) => <button key={e} onClick={(ev) => { ev.stopPropagation(); setMoreRx(false); onReact(e, ref.current); }}>{e}</button>)}</div> : null}</div> : null}
    </div>
  );
}

function ChatSheet({ c, api, P, tasks, onTasks, isMuted, onMute, onSet, onClose }: { c: Chat; api: EwApi; P: Record<string, Person>; tasks?: { enabled: boolean; manage: boolean }; onTasks: (v: boolean) => void; isMuted: boolean; onMute: (on: boolean, dur: number) => void; onSet: (p: Partial<Chat['set']>) => void; onClose: () => void }) {
  const e = c.p ? P[c.p] : null;
  const pr = c.g ? c.mem.filter((id) => P[id] && P[id].st !== 'fora') : [];
  const s = c.set;
  return (
    <>
      <div className="gp" />
      <div className="bn" style={covStyle(e || c)} />
      <div className="bnr">
        <Av p={e || { photo: c.photo, hue: c.hue, i: c.i }} cls="alg" st={e?.st} />
        <div className="bnt"><b>{c.n}</b><small>{c.g ? c.desc || 'Sem descrição' : `${e?.role} · ${e?.dept}`}</small></div>
        {c.g ? (c.canEdit ? <button className="btn sm" id="sedit" onClick={() => api.pgShow({ kind: 'groupEdit', key: c.key })}>Editar</button> : null)
          : <button className="btn sm" id="sedit" onClick={() => e && api.pgShow({ kind: 'profile', id: e.id })}>Ver perfil</button>}
      </div>
      {c.g ? (
        <>
          <div className="sl">Pessoas</div>
          <div className="opt" onClick={() => api.pgShow({ kind: 'members', key: c.key, tab: 0 })}>
            <div className="stk">{pr.slice(0, 4).map((id) => <Av key={id} p={P[id]} st={P[id].st} />)}</div>
            <div>Presentes agora<small>{pr.length} de {c.mem.length} online</small></div><Chev />
          </div>
          <div className="opt" onClick={() => api.pgShow({ kind: 'members', key: c.key, tab: 1 })}><div>{c.kind === 'group' && c.canEdit ? 'Gerenciar membros' : 'Ver membros'}<small>{c.kind === 'group' && c.canEdit ? 'Adicionar, remover e definir administradores' : `${c.mem.length} pessoas neste ${c.kind === 'sector' ? 'setor' : 'grupo'}`}</small></div><Chev /></div>
          {c.kind === 'group' && c.canEdit || c.canSummary ? <div className="sl">Automações</div> : null}
          {c.kind === 'group' && c.canEdit ? <Tg t="Mensagem de boas-vindas" d="Enviada quando entra um novo membro" on={c.welcome !== false} onChange={(v) => {
            api.patchChat(c.key, (x) => ({ ...x, welcome: v }));
            void api.sv(D.updateGroup(c, { name: c.n, description: c.desc, photo: c.photo, cover: c.cover, wall: c.set.wall, wp: c.wp, welcome: v }));
            api.toast(v ? 'Ativado' : 'Desativado');
          }} /> : null}
          {c.canSummary && c.sum ? <div className="opt" onClick={() => api.pgShow({ kind: 'summary', key: c.key })}><div>Resumo diário<small>{c.sum.on ? `Ativo · ${['08:00', '12:00', '18:00'][c.sum.h]} · ${Object.values(c.sum.it).filter(Boolean).length} itens` : 'Desativado'}</small></div><Chev /></div> : null}
        </>
      ) : null}
      <div className="sl">Tarefas</div>
      {tasks?.manage ? <Tg t="Tarefas pelo chat" d="Criar e mover tarefas dos quadros pelo + da conversa" on={!!tasks?.enabled} onChange={onTasks} />
        : <div className="opt"><div>Tarefas pelo chat<small>{tasks?.enabled ? 'Ativado' : 'Desativado'} · só administradores podem mudar</small></div></div>}
      <div className="sl">Fixar</div>
      <Tg t="Fixar conversa" d="Mostra no topo da lista" on={s.pin} onChange={(v) => onSet({ pin: v })} />
      <div className="sl">Tamanho do texto</div><Seg id="fs" items={['Pequeno', 'Médio', 'Grande']} value={s.fs} onChange={(v) => onSet({ fs: v })} />
      <div className="sl">Fonte</div><Seg id="ff" items={['Padrão', 'Serifada', 'Mono']} value={s.ff} onChange={(v) => onSet({ ff: v })} />
      <div className="sl">Cor das minhas mensagens</div>
      <div className="swa" data-id="col">{['#ffffff', '#4f8cff', '#2fbf71', '#8b5cf6'].map((x, i) => <button key={x} data-v={i} aria-label={`Cor ${i + 1}`} className={i === s.col ? 'on' : ''} style={{ background: x }} onClick={() => onSet({ col: i })} />)}</div>
      {c.kind !== 'group' ? <><div className="sl">Fundo do chat</div><Seg id="wall" items={['Nenhum', 'Pontos', 'Cor']} value={s.wall} onChange={(v) => onSet({ wall: v })} /></> : null}
      <div className="sl">Notificações</div>
      <Tg id="mute" t="Silenciar notificações" d="Não receber alertas desta conversa" on={isMuted} onChange={(v) => onMute(v, s.muteDur ?? 2)} />
      <div className="sl" style={{ marginTop: 12 }}>Silenciar por</div>
      <Seg id="muteDur" items={['1 hora', '8 horas', 'Até eu reativar']} value={s.muteDur ?? 2} onChange={(v) => { if (isMuted) onMute(true, v); else onSet({ muteDur: v }); }} />
      <button className="btn sec full ewx-close" onClick={onClose}>Fechar</button>
    </>
  );
}

function GlobalSheet({ spec, api, close, statusClear, setStatusClear }: { spec: GsSpec; api: EwApi; close: () => void; statusClear: number; setStatusClear: (v: number) => void }) {
  const P = api.people;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [exp, setExp] = useState(0);
  const [busy, setBusy] = useState(false);
  const [qq, setQq] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  if (spec.kind === 'status') {
    const clearMs = [30 * 60e3, 3600e3, null, null][statusClear];
    const endOfDay = () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d.getTime() - Date.now(); };
    return (
      <>
        <div className="gp" />
        <div className="shh"><div><b>Definir status</b><small>Visível para toda a equipe</small></div></div>
        {(Object.keys(ST) as StatusKey[]).map((k) => (
          <div key={k} className="opt" onClick={() => { api.setStatus(k, statusClear === 2 ? endOfDay() : clearMs); close(); }}>
            <i className="sdd" style={{ background: ST[k][1] }} />{ST[k][0]}<span className="ck2">{k === api.me.st ? '✓' : ''}</span>
          </div>
        ))}
        <div className="sl">Limpar status</div>
        <Seg id="sc" items={['30 min', '1 hora', 'Hoje', 'Nunca']} value={statusClear} onChange={setStatusClear} />
      </>
    );
  }
  if (spec.kind === 'member') {
    const c = api.cur;
    const p = P[spec.id];
    if (!c || !p) return null;
    const adm = c.adm.includes(p.id);
    return (
      <>
        <div className="gp" />
        <div className="shh"><Av p={p} st={p.st} /><div><b>{p.n}</b><small>{p.role}</small></div></div>
        <div className="sl">Ações</div>
        <div className="opt" onClick={() => { close(); window.setTimeout(() => api.pgShow({ kind: 'profile', id: p.id }), 220); }}>Ver perfil<Chev /></div>
        {!p.me ? <div className="opt" onClick={() => { close(); api.openDm(p.id); }}>Enviar mensagem<Chev /></div> : null}
        {!p.me && c.kind === 'group' && c.canEdit ? (
          <>
            <div className="opt" onClick={() => {
              close();
              api.patchChat(c.key, (x) => ({ ...x, adm: adm ? x.adm.filter((y) => y !== p.id) : [...x.adm, p.id] }));
              void api.sv(D.setGroupAdmin(c, p.id, !adm));
              api.toast(adm ? 'Administrador removido' : `${p.n.split(' ')[0]} agora é administrador`);
            }}>{adm ? 'Remover como administrador' : 'Tornar administrador'}</div>
            <div className="opt danger" onClick={() => {
              close();
              api.patchChat(c.key, (x) => ({ ...x, mem: x.mem.filter((y) => y !== p.id), adm: x.adm.filter((y) => y !== p.id), s: `${x.mem.length - 1} membros` }));
              void api.sv(D.removeGroupMember(c, p.id));
              api.toast(`${p.n.split(' ')[0]} removido do grupo`);
            }}>Remover do grupo</div>
          </>
        ) : null}
      </>
    );
  }
  if (spec.kind === 'add') {
    const c = api.cur;
    if (!c) return null;
    const restP = Object.values(P).filter((p) => !p.sys && !c.mem.includes(p.id) && p.n.toLowerCase().includes(qq.toLowerCase()));
    return (
      <>
        <div className="gp" />
        <div className="shh"><div><b>Adicionar membros</b><small>{restP.length} pessoas disponíveis</small></div></div>
        <label className="srch" style={{ margin: '0 0 10px' }}><I n="search" /><input placeholder="Buscar pessoa" value={qq} onChange={(e) => setQq(e.target.value)} /></label>
        {restP.length ? restP.map((p) => (
          <div key={p.id} className="opt" onClick={async () => {
            api.patchChat(c.key, (x) => ({ ...x, mem: [...x.mem, p.id], s: `${x.mem.length + 1} membros` }));
            const ok = await api.sv(D.addGroupMember(c, p, api.me.id, c.welcome !== false).then(() => true));
            if (ok) api.toast(`${p.n.split(' ')[0]} adicionado`);
            else api.patchChat(c.key, (x) => ({ ...x, mem: x.mem.filter((y) => y !== p.id) }));
          }}>
            <Av p={p} st={p.st} /><div>{p.n}<small>{p.dept}</small></div><button className="btn sm" style={{ marginLeft: 'auto' }}>Adicionar</button>
          </div>
        )) : <div className="hint" style={{ padding: 20 }}>Todos já estão no grupo</div>}
      </>
    );
  }
  if (spec.kind === 'newchat') {
    const list = Object.values(P).filter((p) => !p.me && !p.sys && p.n.toLowerCase().includes(qq.toLowerCase()));
    return (
      <>
        <div className="gp" />
        <div className="shh"><div><b>Nova conversa</b><small>Escolha uma pessoa da equipe</small></div></div>
        <div className="opt" onClick={() => { setQq(''); api.gsOpen({ kind: 'newgroup' }); }}>
          <div className="ewx-ic"><I n="users" /></div><div>Novo grupo<small>Converse com várias pessoas e receba resumos automáticos</small></div><Chev />
        </div>
        <div className="sl">Pessoas</div>
        <label className="srch" style={{ margin: '0 0 10px' }}><I n="search" /><input placeholder="Buscar pessoa" value={qq} onChange={(e) => setQq(e.target.value)} /></label>
        {list.map((p) => (
          <div key={p.id} className="opt" onClick={() => { close(); api.openDm(p.id); }}>
            <Av p={p} st={p.st} /><div>{p.n}<small>{ST[p.st][0]} · {p.dept}</small></div><Chev />
          </div>
        ))}
        {!list.length ? <div className="hint" style={{ padding: 20 }}>Ninguém encontrado</div> : null}
      </>
    );
  }
  if (spec.kind === 'newgroup') {
    const list = Object.values(P).filter((p) => !p.me && !p.sys && p.n.toLowerCase().includes(qq.toLowerCase()));
    return (
      <>
        <div className="gp" />
        <div className="shh"><div><b>Novo grupo</b><small>Você será o administrador</small></div></div>
        <div className="sl">Nome do grupo</div>
        <input className="fld" value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Projeto Expansão" />
        <div className="sl">Descrição (opcional)</div>
        <textarea className="fld" rows={2} value={body} maxLength={160} onChange={(e) => setBody(e.target.value)} placeholder="Para que serve este grupo" />
        <div className="sl">Participantes · {sel.length} selecionados</div>
        <label className="srch" style={{ margin: '0 0 10px' }}><I n="search" /><input placeholder="Buscar pessoa" value={qq} onChange={(e) => setQq(e.target.value)} /></label>
        {list.map((p) => {
          const on = sel.includes(p.id);
          return (
            <div key={p.id} className="opt" onClick={() => setSel((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}>
              <Av p={p} st={p.st} /><div>{p.n}<small>{p.dept}</small></div><span className={'ewx-chk' + (on ? ' on' : '')}>{on ? '✓' : ''}</span>
            </div>
          );
        })}
        <button className="btn full" style={{ marginTop: 14 }} disabled={busy || title.trim().length < 2 || !sel.length} onClick={async () => {
          setBusy(true);
          const id = await api.sv(D.createGroup(title.trim(), body.trim(), sel.map((x) => P[x]).filter(Boolean), api.me, api.boot.companyId));
          if (id) {
            await api.reload();
            api.toast('Grupo criado');
            close();
            api.openChat(`group:${id}`);
          }
          setBusy(false);
        }}>{busy ? 'Criando…' : 'Criar grupo'}</button>
      </>
    );
  }
  // new notice (admins)
  return (
    <>
      <div className="gp" />
      <div className="shh"><div><b>Novo aviso</b><small>Enviado para toda a empresa</small></div></div>
      <div className="sl">Título</div>
      <input className="fld" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Manutenção programada" />
      <div className="sl">Mensagem</div>
      <textarea className="fld" rows={5} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder="Escreva o comunicado" />
      <div style={{ height: 8 }} />
      <Tg t="Fixar no topo" d="Destaque com botão Ciente" on={pinned} onChange={setPinned} />
      <div className="sl">Duração do aviso</div>
      <Seg id="nexp" items={['Sem prazo', '24 h', '3 dias', '7 dias', '30 dias']} value={exp} onChange={setExp} />
      <small className="ewx-nexp">{exp ? `Some sozinho em ${['', '24 horas', '3 dias', '7 dias', '30 dias'][exp]}.` : 'Fica visível até ser apagado.'}</small>
      <button className="btn full" disabled={busy || title.trim().length < 3 || body.trim().length < 3} onClick={async () => {
        setBusy(true);
        const r = await api.sv(D.createNotice(api.me.id, api.boot.companyId, title.trim(), body.trim(), pinned, exp ? new Date(Date.now() + [0, 1, 3, 7, 30][exp] * 864e5).toISOString() : null));
        setBusy(false);
        if (r) { api.toast('Aviso publicado'); close(); }
      }}>{busy ? 'Publicando…' : 'Publicar aviso'}</button>
    </>
  );
}
