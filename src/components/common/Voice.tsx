// Voice note player (decrypts on demand) and recorder hook, shared by desktop and mobile.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fmtDuration, openVoice, pickAudioMime, VoiceError } from '@/lib/e2e';
import type { VoiceRef } from '@/lib/e2e';
import './voice.css';

const BARS = 28;
const bars = (seed: string) => Array.from({ length: BARS }, (_, i) => { let h = 0; for (const c of seed.slice(i % seed.length) + i) h = (h * 31 + c.charCodeAt(0)) | 0; return 25 + (Math.abs(h) % 75); });

export function VoicePlayer({ voice, mine }: { voice: VoiceRef; mine?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'nokey' | 'expired' | 'failed'>('idle');
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const shape = useRef(bars(voice.path)).current;

  useEffect(() => () => { audio.current?.pause(); }, []);
  const toggle = async () => {
    if (state === 'nokey' || state === 'expired') return;
    if (state === 'playing') { audio.current?.pause(); return; }
    if (audio.current && src) { void audio.current.play(); return; }
    setState('loading');
    try {
      const url = await openVoice(voice.path);
      setSrc(url);
      const a = new Audio(url);
      audio.current = a;
      a.onloadedmetadata = () => { if (Number.isFinite(a.duration)) setDur(a.duration); };
      a.ontimeupdate = () => setPos(a.currentTime);
      a.onplay = () => setState('playing');
      a.onpause = () => setState('paused');
      a.onended = () => { setState('paused'); setPos(0); };
      await a.play();
    } catch (e) {
      setState(e instanceof VoiceError ? e.code : 'failed');
    }
  };
  const total = dur || voice.duration.split(':').reduce((m, s) => m * 60 + +s, 0);
  const pct = total ? Math.min(1, pos / total) : 0;
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audio.current || !total) return;
    const r = e.currentTarget.getBoundingClientRect();
    audio.current.currentTime = Math.max(0, Math.min(total, ((e.clientX - r.left) / r.width) * total));
  };
  if (state === 'nokey' || state === 'expired') {
    return <div className="vc vc-off">🔒 {state === 'nokey' ? 'Áudio protegido de ponta a ponta. Disponível só nos aparelhos que já estavam conectados quando ele foi enviado.' : 'Áudio expirou no servidor.'}</div>;
  }
  return (
    <div className={'vc' + (mine ? ' mine' : '')}>
      <button type="button" className="vc-play" onClick={(e) => { e.stopPropagation(); void toggle(); }} aria-label={state === 'playing' ? 'Pausar áudio' : 'Ouvir áudio'}>
        {state === 'loading' ? <span className="vc-spin" /> : state === 'playing'
          ? <svg viewBox="0 0 24 24"><path d="M8 5h3v14H8zM13 5h3v14h-3z" /></svg>
          : <svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" /></svg>}
      </button>
      <div className="vc-wave" onClick={(e) => { e.stopPropagation(); seek(e); }}>
        {shape.map((h, i) => <i key={i} style={{ height: h + '%' }} className={i / BARS < pct ? 'on' : ''} />)}
      </div>
      <span className="vc-t">{fmtDuration(state === 'playing' || pos ? pos : total)}</span>
      <span className="vc-lock" title="Criptografado de ponta a ponta">🔒</span>
      {state === 'failed' ? <small className="vc-err">Não foi possível abrir</small> : null}
    </div>
  );
}

/** Microphone recorder: start → stop gives { blob, seconds }; cancel discards. */
export function useVoiceRecorder(maxSeconds = 300) {
  const [rec, setRec] = useState<{ on: boolean; sec: number }>({ on: false, sec: 0 });
  const r = useRef<{ mr: MediaRecorder; stream: MediaStream; chunks: Blob[]; t0: number; timer: number } | null>(null);
  const stopAll = () => { const x = r.current; if (!x) return; window.clearInterval(x.timer); x.stream.getTracks().forEach((t) => t.stop()); r.current = null; setRec({ on: false, sec: 0 }); };
  const start = useCallback(async () => {
    if (r.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mime = pickAudioMime();
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.start(250);
    const t0 = Date.now();
    const timer = window.setInterval(() => {
      const sec = (Date.now() - t0) / 1000;
      setRec({ on: true, sec });
      if (sec >= maxSeconds) mr.stop();
    }, 200);
    r.current = { mr, stream, chunks, t0, timer };
    setRec({ on: true, sec: 0 });
  }, [maxSeconds]);
  const stop = useCallback(() => new Promise<{ blob: Blob; seconds: number } | null>((res) => {
    const x = r.current;
    if (!x) return res(null);
    const seconds = (Date.now() - x.t0) / 1000;
    x.mr.onstop = () => { const blob = new Blob(x.chunks, { type: x.mr.mimeType || 'audio/webm' }); stopAll(); res(seconds < 0.8 ? null : { blob, seconds }); };
    if (x.mr.state === 'inactive') x.mr.onstop(new Event('stop')); else x.mr.stop();
  }), []);
  const cancel = useCallback(() => { const x = r.current; if (!x) return; x.mr.onstop = null; try { x.mr.stop(); } catch { /* already stopped */ } stopAll(); }, []);
  useEffect(() => () => cancel(), [cancel]);
  return { recording: rec.on, seconds: rec.sec, start, stop, cancel };
}
