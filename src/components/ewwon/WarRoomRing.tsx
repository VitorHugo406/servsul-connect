import { useEffect, useRef, useState } from 'react';
import { useWarRoomAlarm } from '@/hooks/useWarRoomAlarm';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Celular: War Room ativa = a tela toca e vibra como uma ligação até a pessoa tocar em "Ciente".
 * (Com o app fechado, quem toca é a notificação nativa de ligação, renovada a cada minuto pelo servidor.)
 */
export function WarRoomRing() {
  const { user } = useAuth();
  const { isAlarming, pendingWarRoomId, recheckAlarm } = useWarRoomAlarm({ silent: true });
  const [room, setRoom] = useState<{ title: string; description: string | null; by: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!pendingWarRoomId) { setRoom(null); return; }
    let live = true;
    (async () => {
      const { data } = await supabase.from('war_rooms').select('title, description, created_by').eq('id', pendingWarRoomId).maybeSingle();
      if (!live || !data) return;
      const { data: who } = await supabase.from('profiles').select('name, display_name').eq('user_id', (data as any).created_by).maybeSingle();
      if (live) setRoom({ title: (data as any).title, description: (data as any).description, by: (who as any)?.display_name || (who as any)?.name || '' });
    })();
    return () => { live = false; };
  }, [pendingWarRoomId]);

  // toque de telefone (dois toques curtos, pausa) + vibração em laço
  useEffect(() => {
    if (!isAlarming) return;
    let stopped = false;
    const ring = () => {
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = ctxRef.current || (ctxRef.current = new AC());
        if (ctx.state === 'suspended') void ctx.resume();
        const burst = (t0: number) => {
          for (const f of [440, 480]) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
            g.gain.setValueAtTime(0, ctx.currentTime + t0); g.gain.linearRampToValueAtTime(0.28, ctx.currentTime + t0 + 0.03);
            g.gain.setValueAtTime(0.28, ctx.currentTime + t0 + 0.4); g.gain.linearRampToValueAtTime(0, ctx.currentTime + t0 + 0.44);
            o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + 0.46);
          }
        };
        burst(0); burst(0.6);
      } catch { /* sem áudio */ }
      try { navigator.vibrate?.([700, 300, 700, 300, 700]); } catch { /* sem vibração */ }
    };
    ring();
    const iv = window.setInterval(() => { if (!stopped) ring(); }, 3000);
    return () => { stopped = true; window.clearInterval(iv); try { navigator.vibrate?.(0); } catch { /* */ } };
  }, [isAlarming]);

  if (!isAlarming || !pendingWarRoomId) return null;

  const ack = async () => {
    if (!user || busy) return;
    setBusy(true);
    await supabase.from('war_room_members').update({ has_acknowledged: true, acknowledged_at: new Date().toISOString() }).eq('war_room_id', pendingWarRoomId).eq('user_id', user.id);
    await recheckAlarm();
    setBusy(false);
  };

  return (
    <div role="alertdialog" aria-label="War Room ativada" className="wr-ring" style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 28, textAlign: 'center', color: '#fff', background: 'linear-gradient(180deg,#7A1212 0%,#C62828 55%,#8E1B10 100%)', fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
      <style>{`@keyframes wrPulse{0%{transform:scale(1);box-shadow:0 0 0 0 rgba(255,255,255,.55)}70%{transform:scale(1.06);box-shadow:0 0 0 28px rgba(255,255,255,0)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(255,255,255,0)}}`}</style>
      <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 46, animation: 'wrPulse 1.4s ease-out infinite' }}>🚨</div>
      <div style={{ fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .85 }}>War Room ativada</div>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, maxWidth: 340 }}>{room?.title || 'Convocação urgente'}</div>
      {room?.description && <div style={{ fontSize: 14, opacity: .9, maxWidth: 340, lineHeight: 1.4 }}>{room.description}</div>}
      {room?.by && <div style={{ fontSize: 13, opacity: .8 }}>Convocado por {room.by}</div>}
      <button type="button" onClick={ack} disabled={busy}
        style={{ marginTop: 18, height: 60, minWidth: 220, borderRadius: 999, border: 0, background: 'var(--dkx-bg-ffffff,#fff)', color: '#B3261E', font: '700 18px inherit', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,.28)' }}>
        {busy ? 'Confirmando...' : 'Ciente'}
      </button>
      <div style={{ fontSize: 12, opacity: .75 }}>O toque só para quando você confirmar.</div>
    </div>
  );
}
