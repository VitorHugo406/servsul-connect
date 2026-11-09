// In-app video call window (Daily.co Prebuilt in an iframe). Any screen can open it with openVideoCall(eventId).
import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { appConfirm } from '@/lib/appDialog';
import { toast } from 'sonner';

const OPEN_EVENT = 'ewvon:open-video-call';
export const openVideoCall = (eventId: string) => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: eventId }));

export function VideoCallHost() {
  const [call, setCall] = useState<{ src: string; title: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onOpen = async (e: Event) => {
      const eventId = (e as CustomEvent<string>).detail;
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('video/join', { body: { event_id: eventId } });
        if (error || !(data as any)?.token) {
          let msg = 'Não foi possível entrar na chamada.';
          try { const b = await (error as any)?.context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
          if ((data as any)?.error) msg = (data as any).error;
          toast.error(msg); return;
        }
        const d = data as any;
        setCall({ src: `${d.url}?t=${encodeURIComponent(d.token)}`, title: d.title || 'Videochamada' });
      } finally { setLoading(false); }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const close = async () => {
    if (await appConfirm({ title: 'Sair da chamada?', message: 'Você pode voltar a qualquer momento pelo calendário.', confirmText: 'Sair', danger: true })) setCall(null);
  };

  if (loading) return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 text-white"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (!call) return null;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0b0b0e]" role="dialog" aria-label={call.title}>
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 px-4 text-white">
        <p className="truncate text-sm font-semibold">{call.title}</p>
        <button type="button" onClick={() => void close()} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Sair da chamada"><X className="h-4 w-4" /></button>
      </div>
      <iframe title={call.title} src={call.src} className="min-h-0 flex-1 border-0" allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write; speaker-selection" />
    </div>
  );
}
