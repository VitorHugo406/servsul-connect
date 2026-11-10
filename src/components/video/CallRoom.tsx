// ewvon's own video call: peer-to-peer WebRTC (mesh, up to MAX_PEOPLE) with Supabase Realtime as signaling.
// Presence lists who is in the call; the person with the lower id sends the offer to avoid double offers.
// Media never goes through ewvon servers: only the connection setup messages (offer/answer/ICE) do.
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAX_PEOPLE = 6;
const RING_TIMEOUT_MS = 45_000;   // chat calls: nobody answered
const ALONE_GRACE_MS = 1_500;     // chat calls: the others left, end like WhatsApp
export type LeaveInfo = { why: 'hangup' | 'alone' | 'timeout' | 'error'; alone: boolean };
const ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
type Signal = { to: string; from: string; name: string; type: 'offer' | 'answer' | 'ice'; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
type Peer = { pc: RTCPeerConnection; stream: MediaStream | null; name: string; pending: RTCIceCandidateInit[] };

function Tile({ stream, name, muted, mirror, off }: { stream: MediaStream | null; name: string; muted?: boolean; mirror?: boolean; off?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream; }, [stream]);
  return (
    <div className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-2xl bg-[#1c1c22]">
      <video ref={ref} autoPlay playsInline muted={muted} className={`h-full w-full object-cover ${mirror ? '-scale-x-100' : ''} ${off || !stream ? 'invisible' : ''}`} />
      {off || !stream ? <span className="absolute flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-xl font-semibold text-white">{(name || '?').charAt(0).toUpperCase()}</span> : null}
      <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-medium text-white">{name}</span>
    </div>
  );
}

export function CallRoom({ callId, title, me, onLeave, audioOnly = false, ring = false, onConnected, onPeerCount }: {
  callId: string; title: string; me: { id: string; name: string }; onLeave: (info: LeaveInfo) => void; audioOnly?: boolean;
  /** Chat call: stops ringing after RING_TIMEOUT_MS and ends when everybody else left. Calendar meetings pass false. */
  ring?: boolean; onConnected?: () => void; onPeerCount?: (n: number) => void;
}) {
  const leaveRef = useRef(onLeave); leaveRef.current = onLeave;
  const connectedRef = useRef(onConnected); connectedRef.current = onConnected;
  const countRef = useRef(onPeerCount); countRef.current = onPeerCount;
  const hadPeersRef = useRef(false);
  const leftRef = useRef(false);
  const leave = (why: LeaveInfo['why']) => { if (leftRef.current) return; leftRef.current = true; leaveRef.current({ why, alone: peersRef.current.size === 0 }); };
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, { stream: MediaStream | null; name: string }>>({});
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(!audioOnly);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => tick((x) => x + 1), 1000); return () => window.clearInterval(t); }, []);
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState<'starting' | 'live' | 'full'>('starting');
  const peersRef = useRef(new Map<string, Peer>());
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStreamTrack | null>(null);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let alive = true;
    const sync = () => { setPeers(Object.fromEntries([...peersRef.current].map(([k, p]) => [k, { stream: p.stream, name: p.name }]))); countRef.current?.(peersRef.current.size); };
    let aloneTimer: number | null = null;
    const checkAlone = () => {
      if (!ring || !hadPeersRef.current || peersRef.current.size) return;
      if (aloneTimer != null) window.clearTimeout(aloneTimer);
      aloneTimer = window.setTimeout(() => { if (alive && !peersRef.current.size) leave('alone'); }, ALONE_GRACE_MS);
    };
    const ringTimer = ring ? window.setTimeout(() => { if (alive && !hadPeersRef.current) leave('timeout'); }, RING_TIMEOUT_MS) : null;
    const send = (s: Omit<Signal, 'from' | 'name'>) => void chanRef.current?.send({ type: 'broadcast', event: 'signal', payload: { ...s, from: me.id, name: me.name } });
    const drop = (id: string) => { const p = peersRef.current.get(id); if (p) { p.pc.close(); peersRef.current.delete(id); sync(); checkAlone(); } };
    const peer = (id: string, name: string) => {
      const found = peersRef.current.get(id); if (found) return found;
      const pc = new RTCPeerConnection({ iceServers: ICE });
      const p: Peer = { pc, stream: null, name, pending: [] };
      localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!));
      if (screenRef.current) { const s = pc.getSenders().find((x) => x.track?.kind === 'video'); void s?.replaceTrack(screenRef.current); }
      pc.ontrack = (e) => { p.stream = e.streams[0] || new MediaStream([e.track]); setStartedAt((t) => t ?? Date.now()); if (!hadPeersRef.current) { hadPeersRef.current = true; connectedRef.current?.(); } sync(); };
      pc.onicecandidate = (e) => { if (e.candidate) send({ to: id, type: 'ice', candidate: e.candidate.toJSON() }); };
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { toast.error(`Não foi possível conectar com ${name}. A rede de um dos lados pode estar bloqueando chamadas.`); drop(id); } };
      peersRef.current.set(id, p); sync();
      return p;
    };
    const flush = async (p: Peer) => { for (const c of p.pending.splice(0)) await p.pc.addIceCandidate(c).catch(() => {}); };

    (async () => {
      let stream: MediaStream;
      try { stream = await navigator.mediaDevices.getUserMedia(audioOnly ? { audio: { echoCancellation: true, noiseSuppression: true } } : { audio: { echoCancellation: true, noiseSuppression: true }, video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } } }); }
      catch {
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); setCam(false); toast.message('Câmera indisponível: você entrou só com áudio.'); }
        catch { toast.error('Permita o acesso ao microfone e à câmera para entrar na chamada.'); leave('error'); return; }
      }
      if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
      localRef.current = stream; setLocal(stream);
      const ch = supabase.channel(`ewvon-call-${callId}`, { config: { broadcast: { self: false }, presence: { key: me.id } } });
      chanRef.current = ch;
      ch.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const s = payload as Signal;
        if (s.to !== me.id || s.from === me.id) return;
        const p = peer(s.from, s.name);
        try {
          if (s.type === 'offer' && s.sdp) {
            await p.pc.setRemoteDescription(s.sdp); await flush(p);
            const answer = await p.pc.createAnswer(); await p.pc.setLocalDescription(answer);
            send({ to: s.from, type: 'answer', sdp: p.pc.localDescription!.toJSON() });
          } else if (s.type === 'answer' && s.sdp) { await p.pc.setRemoteDescription(s.sdp); await flush(p); }
          else if (s.type === 'ice' && s.candidate) { if (p.pc.remoteDescription) await p.pc.addIceCandidate(s.candidate).catch(() => {}); else p.pending.push(s.candidate); }
        } catch (e) { console.error('call signal', e); }
      });
      // The other side hung up: drop them right away instead of waiting for presence to time out.
      ch.on('broadcast', { event: 'bye' }, ({ payload }) => { const id = (payload as { from?: string })?.from; if (id && id !== me.id) drop(id); });
      ch.on('presence', { event: 'sync' }, async () => {
        const state = ch.presenceState() as Record<string, { name: string }[]>;
        const ids = Object.keys(state);
        if (ids.length > MAX_PEOPLE && !peersRef.current.size && ids.sort().indexOf(me.id) >= MAX_PEOPLE) { setStatus('full'); return; }
        for (const id of ids) {
          if (id === me.id || peersRef.current.has(id) || me.id > id) continue;   // lower id starts
          const p = peer(id, state[id]?.[0]?.name || 'Participante');
          const offer = await p.pc.createOffer(); await p.pc.setLocalDescription(offer);
          send({ to: id, type: 'offer', sdp: p.pc.localDescription!.toJSON() });
        }
        for (const id of [...peersRef.current.keys()]) if (!ids.includes(id)) drop(id);
      });
      ch.subscribe(async (st) => { if (st === 'SUBSCRIBED') { await ch.track({ name: me.name }); setStatus('live'); } });
    })();

    return () => {
      alive = false;
      if (ringTimer != null) window.clearTimeout(ringTimer);
      if (aloneTimer != null) window.clearTimeout(aloneTimer);
      peersRef.current.forEach((p) => p.pc.close()); peersRef.current.clear();
      screenRef.current?.stop();
      localRef.current?.getTracks().forEach((t) => t.stop());
      if (chanRef.current) { void chanRef.current.untrack(); void supabase.removeChannel(chanRef.current); }
    };
  }, [callId, me.id, me.name, audioOnly, ring]); // eslint-disable-line react-hooks/exhaustive-deps

  const hangup = () => { void chanRef.current?.send({ type: 'broadcast', event: 'bye', payload: { from: me.id } }); leave('hangup'); };
  const toggleMic = () => { localRef.current?.getAudioTracks().forEach((t) => { t.enabled = !mic; }); setMic(!mic); };
  const toggleCam = () => { localRef.current?.getVideoTracks().forEach((t) => { t.enabled = !cam; }); setCam(!cam); };
  const toggleShare = async () => {
    const camTrack = localRef.current?.getVideoTracks()[0] || null;
    const swap = (track: MediaStreamTrack | null) => peersRef.current.forEach((p) => { const s = p.pc.getSenders().find((x) => x.track?.kind === 'video' || (!x.track && track)); void s?.replaceTrack(track); });
    if (sharing) { screenRef.current?.stop(); screenRef.current = null; swap(camTrack); setSharing(false); return; }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      screenRef.current = track; swap(track); setSharing(true);
      track.onended = () => { screenRef.current = null; swap(camTrack); setSharing(false); };
    } catch { /* cancelled */ }
  };

  const others = Object.entries(peers);
  const count = others.length + 1;
  const cols = count <= 1 ? 'grid-cols-1' : count <= 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3';
  const btn = (on: boolean) => `flex h-12 w-12 items-center justify-center rounded-full transition-colors ${on ? 'bg-white/12 text-white hover:bg-white/20' : 'bg-white text-[#0b0b0e]'}`;

  if (status === 'full') return <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-white"><p className="text-lg font-semibold">Chamada cheia</p><p className="text-sm text-white/70">Esta chamada já tem {MAX_PEOPLE} pessoas.</p><button type="button" onClick={() => leave('error')} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">Voltar</button></div>;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`grid min-h-0 flex-1 auto-rows-fr gap-2 p-2 sm:p-3 ${cols}`}>
        <Tile stream={local} name={`${me.name} (você)`} muted mirror={!sharing} off={audioOnly || (!cam && !sharing)} />
        {others.map(([id, p]) => <Tile key={id} stream={p.stream} name={p.name} off={audioOnly} />)}
      </div>
      <p className="pb-1 text-center text-[13px] tabular-nums text-white/70">{status === 'starting' ? <><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Conectando…</> : others.length === 0 ? 'Chamando…' : startedAt ? (() => { const sec = Math.floor((Date.now() - startedAt) / 1000); return `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`; })() : 'Conectando…'}</p>
      <div className="flex shrink-0 items-center justify-center gap-3 p-3 sm:p-4" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}>
        <button type="button" className={btn(mic)} onClick={toggleMic} aria-label={mic ? 'Desligar microfone' : 'Ligar microfone'}>{mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
        {audioOnly ? null : <button type="button" className={btn(cam)} onClick={toggleCam} aria-label={cam ? 'Desligar câmera' : 'Ligar câmera'}>{cam ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</button>}
        {!audioOnly && typeof navigator !== 'undefined' && 'getDisplayMedia' in (navigator.mediaDevices || {}) ? <button type="button" className={btn(!sharing)} onClick={() => void toggleShare()} aria-label={sharing ? 'Parar de compartilhar' : 'Compartilhar tela'}><MonitorUp className="h-5 w-5" /></button> : null}
        <button type="button" className="flex h-12 w-14 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700" onClick={hangup} aria-label="Encerrar chamada"><PhoneOff className="h-5 w-5" /></button>
      </div>
    </div>
  );
}
