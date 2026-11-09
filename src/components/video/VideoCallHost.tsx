// ewvon calls (own system, peer-to-peer), WhatsApp style: voice or video, from the chat or a calendar meeting.
// startChatCall(conv, target, audio) posts a call card in the conversation, rings the other members and joins;
// joinChatCall(id, audio) joins from that card; openVideoCall(eventId, title) joins a calendar meeting.
// Ringing: each signed-in person listens on the Realtime broadcast channel "ewvon-ring-<profileId>".
import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { appConfirm } from '@/lib/appDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CallRoom } from './CallRoom';
import { toast } from 'sonner';

const OPEN_EVENT = 'ewvon:open-video-call';
const INFO_EVENT = 'ewvon:video-info';
type Conv = 'dm' | 'group' | 'sector';
type Req = { kind: 'join'; callId: string; title: string; audio: boolean } | { kind: 'chat-start'; conv: Conv; target: string; audio: boolean };
type Ring = { callId: string; audio: boolean; from: string; fromName: string; title: string };
const fire = (r: Req) => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: r }));
export const openVideoCall = (eventId: string, title = 'Reunião') => fire({ kind: 'join', callId: eventId, title, audio: false });
export const startChatCall = (conv: Conv, target: string, audio = false) => fire({ kind: 'chat-start', conv, target, audio });
export const joinChatCall = (callId: string, audio = false) => fire({ kind: 'join', callId, title: audio ? 'Chamada de voz' : 'Chamada de vídeo', audio });
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
  const Icon = room.audio ? Phone : Video;
  return (
    <div className="flex min-w-[220px] items-center gap-3 rounded-xl border border-border bg-card p-3 text-foreground">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold">{room.audio ? 'Chamada de voz' : 'Chamada de vídeo'}</p><p className="text-[11px] text-muted-foreground">{own ? 'Você iniciou uma chamada' : 'Toque para participar'}</p></div>
      <button type="button" onClick={(e) => { e.stopPropagation(); joinChatCall(room.id, room.audio); }} className="shrink-0 rounded-full bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-600">Entrar</button>
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
  const [call, setCall] = useState<{ id: string; title: string; audio: boolean } | null>(null);
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
      if (r.kind === 'join') { setCall({ id: r.callId, title: r.title, audio: r.audio }); return; }
      const id = crypto.randomUUID();
      const content = `${r.audio ? VOICE_PREFIX : VIDEO_PREFIX}${id}`;
      const { error } = r.conv === 'dm'
        ? await (supabase as any).from('direct_messages').insert({ sender_id: me.id, receiver_id: r.target, content, company_id: me.company })
        : r.conv === 'group'
          ? await (supabase as any).from('private_group_messages').insert({ group_id: r.target, sender_id: me.id, content })
          : await (supabase as any).from('messages').insert({ content, author_id: me.id, sector_id: r.target, company_id: me.company });
      if (error) { toast.error('Não foi possível iniciar a chamada nesta conversa.'); return; }
      const title = r.audio ? 'Chamada de voz' : 'Chamada de vídeo';
      setCall({ id, title, audio: r.audio });
      const ring: Ring = { callId: id, audio: r.audio, from: me.id, fromName: me.name, title };
      void ringTargets(r.conv, r.target, me.id, me.company).then((ids) => Promise.all(ids.map((pid) => broadcast(pid, 'ring', ring))));
    };
    const onInfo = () => setInfo(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(INFO_EVENT, onInfo);
    return () => { window.removeEventListener(OPEN_EVENT, onOpen); window.removeEventListener(INFO_EVENT, onInfo); };
  }, [me?.id, me?.name, me?.company]); // eslint-disable-line react-hooks/exhaustive-deps

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
    ch.on('broadcast', { event: 'declined' }, ({ payload }) => { const p = payload as { name: string; callId: string }; if (callRef.current?.id === p.callId) toast.message(`${p.name} recusou a chamada.`); });
    ch.subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [me?.id]);

  const leave = useCallback(() => setCall(null), []);
  const askLeave = async () => { if (await appConfirm({ title: 'Encerrar chamada?', message: 'Você pode voltar pelo botão Entrar no chat enquanto houver gente na chamada.', confirmText: 'Sair', danger: true })) leave(); };
  const accept = () => { if (!incoming) return; setCall({ id: incoming.callId, title: incoming.title, audio: incoming.audio }); setIncoming(null); };
  const decline = () => { if (!incoming || !me) return; void broadcast(incoming.from, 'declined', { name: me.name, callId: incoming.callId }); setIncoming(null); };

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
            <button type="button" onClick={() => void askLeave()} className="rounded-full bg-white/10 px-3 py-1 text-[12px] hover:bg-white/20">Sair</button>
          </div>
          <CallRoom callId={call.id} title={call.title} me={me} onLeave={leave} audioOnly={call.audio} />
        </div>
      ) : null}
    </>
  );
}
