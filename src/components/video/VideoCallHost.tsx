// ewvon calls (own system, peer-to-peer), WhatsApp style: voice or video, from the chat or a calendar meeting.
// startChatCall(conv, target, audio) posts a call card in the conversation, rings the other members and joins;
// joinChatCall(id, audio) joins from that card; openVideoCall(eventId, title) joins a calendar meeting.
// Ringing: each signed-in person listens on the Realtime broadcast channel "ewvon-ring-<profileId>".
import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, PhoneMissed, PhoneIncoming, PhoneOutgoing, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CallRoom, type LeaveInfo } from './CallRoom';
import { useCallInfo, effectiveStatus, formatCallDuration, callCreate, callAnswered, callEnd } from './callStore';
import { toast } from 'sonner';

const OPEN_EVENT = 'ewvon:open-video-call';
const INFO_EVENT = 'ewvon:video-info';
type Conv = 'dm' | 'group' | 'sector';
type Req = { kind: 'join'; callId: string; title: string; audio: boolean; chat?: boolean } | { kind: 'chat-start'; conv: Conv; target: string; audio: boolean };
type Ring = { callId: string; audio: boolean; from: string; fromName: string; title: string; conv?: Conv };
type Active = { id: string; title: string; audio: boolean; chat: boolean; conv?: Conv; caller?: boolean };
const fire = (r: Req) => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: r }));
export const openVideoCall = (eventId: string, title = 'Reunião') => fire({ kind: 'join', callId: eventId, title, audio: false });
export const startChatCall = (conv: Conv, target: string, audio = false) => fire({ kind: 'chat-start', conv, target, audio });
export const joinChatCall = (callId: string, audio = false) => fire({ kind: 'join', callId, title: audio ? 'Chamada de voz' : 'Chamada de vídeo', audio, chat: true });
export const openVideoInfo = () => window.dispatchEvent(new Event(INFO_EVENT));

// Chat messages that announce a call: "📹 ewvon-call:<uuid>" (video) or "📞 ewvon-call:<uuid>" (voice).
const VIDEO_PREFIX = '📹 ewvon-call:';
const VOICE_PREFIX = '📞 ewvon-call:';
export const parseCall = (content?: string | null): { id: string; audio: boolean } | null => {
  if (!content) return null;
  const audio = content.startsWith(VOICE_PREFIX);
  if (!audio && !content.startsWith(VIDEO_PREFIX)) return null;
  const id = content.slice((audio ? VOICE_PREFIX : VIDEO_PREFIX).length).trim();
  return /^[0-9a-f-]{36}$/.test(id) ? { id, audio } : null;
};

export function CallMessageCard({ room, own }: { room: { id: string; audio: boolean }; own?: boolean }) {
  const info = useCallInfo(room.id);
  const [, tick] = useState(0);
  // A "ringing" card turns into "missed" on its own after a minute, even without a server update.
  useEffect(() => { if (info?.status !== 'ringing') return; const t = window.setInterval(() => tick((x) => x + 1), 5000); return () => window.clearInterval(t); }, [info?.status]);
  const kind = room.audio ? 'voz' : 'vídeo';
  const status = info ? effectiveStatus(info) : null;
  const callBack = () => { if (!info) return; const tgt = info.conv === 'dm' ? (own ? info.target : info.caller_id) : info.target; startChatCall(info.conv, tgt, room.audio); };

  let title = room.audio ? 'Chamada de voz' : 'Chamada de vídeo';
  let sub = own ? 'Você ligou' : 'Chamada recebida';
  let tone: 'live' | 'missed' | 'done' = 'done';
  let action: { label: string; run: () => void; icon?: boolean } | null = null;
  const Base = room.audio ? Phone : Video;
  let Icon = own ? PhoneOutgoing : PhoneIncoming;
  if (info === undefined) { sub = 'Carregando…'; Icon = Base; }
  else if (info === null) { sub = 'Chamada encerrada'; Icon = Base; }   // calls made before the history existed
  else if (status === 'ringing') { tone = 'live'; Icon = Base; sub = own ? 'Chamando…' : 'Tocando agora'; action = { label: own ? 'Voltar' : 'Atender', run: () => joinChatCall(room.id, room.audio) }; }
  else if (status === 'ongoing') { tone = 'live'; Icon = Base; title = `Chamada de ${kind} em andamento`; sub = 'Toque para entrar'; action = { label: 'Entrar', run: () => joinChatCall(room.id, room.audio) }; }
  else if (status === 'ended') { sub = formatCallDuration(info.duration_sec) || 'Encerrada'; }
  else if (status === 'declined') { tone = own ? 'done' : 'missed'; title = own ? 'Chamada recusada' : `Chamada de ${kind} recusada`; sub = own ? 'Não atendeu' : 'Você recusou'; Icon = PhoneMissed; }
  else if (status === 'missed') { tone = own ? 'done' : 'missed'; title = own ? 'Chamada não atendida' : `Chamada de ${kind} perdida`; sub = own ? 'Ninguém atendeu' : 'Ligue de volta'; Icon = PhoneMissed; }
  if (info && (status === 'ended' || status === 'missed' || status === 'declined')) action = { label: 'Ligar de novo', run: callBack, icon: true };

  return (
    <div className={`ewvon-callcard is-${tone}`} onClick={action ? (e) => { e.stopPropagation(); action!.run(); } : undefined} role={action ? 'button' : undefined}>
      <span className="ewvon-callcard-ic"><Icon className="h-[18px] w-[18px]" /></span>
      <span className="ewvon-callcard-tx"><b>{title}</b><small>{sub}</small></span>
      {action ? (action.icon
        ? <button type="button" className="ewvon-callcard-redial" aria-label={action.label} title={action.label} onClick={(e) => { e.stopPropagation(); action!.run(); }}><Base className="h-4 w-4" /></button>
        : <button type="button" className="ewvon-callcard-btn" onClick={(e) => { e.stopPropagation(); action!.run(); }}>{action.label}</button>) : null}
    </div>
  );
}

function VideoInfoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Como funcionam as chamadas</DialogTitle><DialogDescription>Chamadas de voz e de vídeo do próprio ewvon, no chat e nas reuniões do calendário.</DialogDescription></DialogHeader>
        <div className="space-y-3 text-[13px] text-muted-foreground">
          <p><b className="text-foreground">Plano:</b> disponível no plano <b>Empresarial</b>, no PC e no celular.</p>
          <p><b className="text-foreground">Sem custo por minuto:</b> o áudio e o vídeo vão direto entre os aparelhos dos participantes; não há franquia nem cobrança extra.</p>
          <p><b className="text-foreground">Como no WhatsApp:</b> no topo da conversa, toque no telefone (voz) ou na câmera (vídeo). Quem está online recebe a chamada tocando, com Atender e Recusar; a chamada também fica no chat com o botão Entrar.</p>
          <p><b className="text-foreground">Até 6 pessoas</b> por chamada, com microfone, câmera e compartilhamento de tela (no PC).</p>
          <p><b className="text-foreground">Rede:</b> em algumas redes corporativas muito fechadas a conexão direta pode ser bloqueada. Se acontecer, tente por outra rede (por exemplo, 4G).</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simple two-tone ring with Web Audio (no audio file needed) + vibration on phones.
function useRingtone(on: boolean) {
  useEffect(() => {
    if (!on) return;
    let ctx: AudioContext | null = null;
    try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { /* no audio */ }
    const ring = () => {
      if (ctx) {
        const t = ctx.currentTime;
        [0, 0.45].forEach((d) => { const o = ctx!.createOscillator(); const g = ctx!.createGain(); o.frequency.value = 480; o.connect(g); g.connect(ctx!.destination); g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35); o.start(t + d); o.stop(t + d + 0.4); });
      }
      try { navigator.vibrate?.([400, 200, 400]); } catch { /* no vibration */ }
    };
    ring();
    const t = window.setInterval(ring, 2500);
    return () => { window.clearInterval(t); try { navigator.vibrate?.(0); } catch { /* ignore */ } void ctx?.close(); };
  }, [on]);
}

// Who should hear the phone ring for this conversation (profile ids, without me).
async function ringTargets(conv: Conv, target: string, meId: string, companyId: string): Promise<string[]> {
  let ids: string[] = [];
  if (conv === 'dm') ids = [target];
  else if (conv === 'group') {
    const { data } = await (supabase as any).from('private_group_members').select('profile_id').eq('group_id', target).limit(60);
    ids = (data || []).map((r: any) => r.profile_id).filter(Boolean);
  } else {
    const [{ data: main }, { data: extra }] = await Promise.all([
      (supabase as any).from('profiles').select('id').eq('company_id', companyId).eq('sector_id', target).eq('is_active', true).limit(60),
      (supabase as any).from('user_additional_sectors').select('user_id').eq('sector_id', target).limit(60),
    ]);
    ids = (main || []).map((r: any) => r.id);
    const uids = (extra || []).map((r: any) => r.user_id);
    if (uids.length) { const { data: more } = await (supabase as any).from('profiles').select('id').in('user_id', uids).eq('is_active', true); ids.push(...(more || []).map((r: any) => r.id)); }
  }
  return [...new Set(ids)].filter((id) => id && id !== meId).slice(0, 60);
}
async function broadcast(profileId: string, event: string, payload: unknown) {
  const ch = supabase.channel(`ewvon-ring-${profileId}`);
  try { await ch.send({ type: 'broadcast', event, payload }); } catch { /* offline */ } finally { void supabase.removeChannel(ch); }
}

export function VideoCallHost() {
  const { profile } = useAuth();
  const [call, setCall] = useState<Active | null>(null);
  const ringedRef = useRef<{ callId: string; ids: string[] } | null>(null);   // who I rang for my outgoing call
  const peerCountRef = useRef(0);
  const answeredRef = useRef(false);
  const answeredAtRef = useRef<number | null>(null);
  const [incoming, setIncoming] = useState<Ring | null>(null);
  const [info, setInfo] = useState(false);
  const callRef = useRef(call); callRef.current = call;
  const me = profile ? { id: (profile as any).id as string, name: ((profile as any).display_name || (profile as any).name || 'Você') as string, company: (profile as any).company_id as string } : null;
  useRingtone(!!incoming);

  // Open / start calls.
  useEffect(() => {
    const onOpen = async (e: Event) => {
      const r = (e as CustomEvent<Req>).detail;
      if (!me) return;
      if (r.kind === 'join') { peerCountRef.current = 0; answeredRef.current = false; setCall({ id: r.callId, title: r.title, audio: r.audio, chat: r.chat ?? false }); return; }
      const id = crypto.randomUUID();
      await callCreate(id, r.conv, r.target, r.audio);   // history row first, so the card shows the right state at once
      const content = `${r.audio ? VOICE_PREFIX : VIDEO_PREFIX}${id}`;
      const { error } = r.conv === 'dm'
        ? await (supabase as any).from('direct_messages').insert({ sender_id: me.id, receiver_id: r.target, content, company_id: me.company })
        : r.conv === 'group'
          ? await (supabase as any).from('private_group_messages').insert({ group_id: r.target, sender_id: me.id, content })
          : await (supabase as any).from('messages').insert({ content, author_id: me.id, sector_id: r.target, company_id: me.company });
      if (error) { toast.error('Não foi possível iniciar a chamada nesta conversa.'); return; }
      const title = r.audio ? 'Chamada de voz' : 'Chamada de vídeo';
      peerCountRef.current = 0; answeredRef.current = false;
      setCall({ id, title, audio: r.audio, chat: true, conv: r.conv, caller: true });
      const ring: Ring = { callId: id, audio: r.audio, from: me.id, fromName: me.name, title, conv: r.conv };
      void ringTargets(r.conv, r.target, me.id, me.company).then((ids) => { ringedRef.current = { callId: id, ids }; return Promise.all(ids.map((pid) => broadcast(pid, 'ring', ring))); });
    };
    const onInfo = () => setInfo(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(INFO_EVENT, onInfo);
    return () => { window.removeEventListener(OPEN_EVENT, onOpen); window.removeEventListener(INFO_EVENT, onInfo); };
  }, [me?.id, me?.name, me?.company]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opened from a call notification ("Atender" / tap): /?call=<id>&a=1|0, or the service worker's message.
  useEffect(() => {
    if (!me?.id) return;
    const openFrom = (url: string) => {
      const q = new URL(url, location.origin).searchParams;
      const id = q.get('call');
      if (!id || !/^[0-9a-f-]{36}$/.test(id)) return false;
      const audio = q.get('a') === '1';
      setIncoming(null);
      peerCountRef.current = 0; answeredRef.current = false;
      setCall({ id, title: audio ? 'Chamada de voz' : 'Chamada de vídeo', audio, chat: true });
      return true;
    };
    if (openFrom(location.href)) { const u = new URL(location.href); u.searchParams.delete('call'); u.searchParams.delete('a'); history.replaceState(null, '', u.toString()); }
    const onMsg = (e: MessageEvent) => { const m = e.data || {}; if (m.type === 'ewvon-open' && m.url) openFrom(m.url); };
    navigator.serviceWorker?.addEventListener?.('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener?.('message', onMsg);
  }, [me?.id]);

  // Incoming calls ring here.
  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase.channel(`ewvon-ring-${me.id}`);
    ch.on('broadcast', { event: 'ring' }, ({ payload }) => {
      const r = payload as Ring;
      if (!r?.callId || callRef.current) return;   // already in a call
      setIncoming(r);
      window.setTimeout(() => setIncoming((cur) => (cur?.callId === r.callId ? null : cur)), 35000);
    });
    ch.on('broadcast', { event: 'declined' }, ({ payload }) => {
      const p = payload as { name: string; callId: string };
      const cur = callRef.current;
      if (cur?.id !== p.callId) return;
      // One-to-one call declined while still ringing: it ends for the caller too (WhatsApp).
      if (cur.conv === 'dm' && peerCountRef.current === 0) { void callEnd(cur.id, 'declined'); setCall(null); toast.message(`${p.name} recusou a chamada.`); }
      else toast.message(`${p.name} recusou a chamada.`);
    });
    // The caller gave up before anyone answered: stop ringing here.
    ch.on('broadcast', { event: 'cancel' }, ({ payload }) => {
      const p = payload as { callId: string; fromName: string; audio: boolean };
      setIncoming((cur) => { if (cur?.callId !== p.callId) return cur; toast.message(`Chamada de ${p.audio ? 'voz' : 'vídeo'} perdida de ${p.fromName}`); return null; });
    });
    ch.subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [me?.id]);

  // Leaving: when nobody else is left, the call is over for everyone (history gets status + duration).
  const leave = useCallback((info: LeaveInfo) => {
    const cur = callRef.current;
    setCall(null);
    const localSec = answeredAtRef.current ? Math.round((Date.now() - answeredAtRef.current) / 1000) : null;
    answeredAtRef.current = null;
    if (!cur?.chat || !me) return;
    if (!info.alone) { if (localSec != null && info.why === 'hangup') toast.message(`Chamada encerrada · ${formatCallDuration(localSec)}`); return; }
    const ringed = ringedRef.current;
    void callEnd(cur.id).then((r) => {
      const answered = answeredRef.current || r?.status === 'ended';
      if (!answered && ringed?.callId === cur.id) void Promise.all(ringed.ids.map((pid) => broadcast(pid, 'cancel', { callId: cur.id, fromName: me.name, audio: cur.audio })));
      if (info.why === 'error') return;
      if (answered) { const sec = r?.duration_sec ?? localSec; toast.message(`Chamada encerrada${sec != null ? ` · ${formatCallDuration(sec)}` : ''}`); }
      else toast.message(info.why === 'timeout' ? 'Ninguém atendeu.' : 'Chamada cancelada.');
    });
  }, [me?.id, me?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const onConnected = useCallback(() => { const cur = callRef.current; answeredRef.current = true; answeredAtRef.current ??= Date.now(); if (cur?.chat) void callAnswered(cur.id); }, []);
  const onPeerCount = useCallback((n: number) => { peerCountRef.current = n; }, []);
  const accept = () => { if (!incoming) return; peerCountRef.current = 0; answeredRef.current = false; setCall({ id: incoming.callId, title: incoming.title, audio: incoming.audio, chat: true, conv: incoming.conv }); setIncoming(null); };
  const decline = () => {
    if (!incoming || !me) return;
    void broadcast(incoming.from, 'declined', { name: me.name, callId: incoming.callId });
    if (incoming.conv === 'dm') void callEnd(incoming.callId, 'declined');
    setIncoming(null);
  };

  return (
    <>
      <VideoInfoDialog open={info} onOpenChange={setInfo} />
      {incoming && !call ? (
        <div className="fixed inset-x-3 top-3 z-[75] mx-auto flex max-w-md items-center gap-3 rounded-3xl bg-[#111114] p-4 text-white shadow-2xl" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }} role="alertdialog" aria-label="Chamada recebida">
          <span className="flex h-12 w-12 shrink-0 animate-pulse items-center justify-center rounded-full bg-emerald-500 text-lg font-semibold">{incoming.fromName.charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold">{incoming.fromName}</p><p className="text-[12px] text-white/70">{incoming.audio ? 'Chamada de voz do ewvon' : 'Chamada de vídeo do ewvon'}</p></div>
          <button type="button" onClick={decline} className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 hover:bg-red-700" aria-label="Recusar"><PhoneOff className="h-5 w-5" /></button>
          <button type="button" onClick={accept} className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600" aria-label="Atender">{incoming.audio ? <Phone className="h-5 w-5" /> : <Video className="h-5 w-5" />}</button>
        </div>
      ) : null}
      {call && me ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-[#0b0b0e]" role="dialog" aria-label={call.title}>
          <div className="flex h-12 shrink-0 items-center justify-between gap-3 px-4 text-white" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
            <p className="truncate text-sm font-semibold">{call.title}</p>
          </div>
          <CallRoom callId={call.id} title={call.title} me={me} onLeave={leave} audioOnly={call.audio} ring={call.chat} onConnected={onConnected} onPeerCount={onPeerCount} />
        </div>
      ) : null}
    </>
  );
}
