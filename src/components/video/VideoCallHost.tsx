// In-app video call window (Daily.co Prebuilt in an iframe) + the "Saiba mais" explanation.
// Any screen opens a call with openVideoCall(eventId), startChatCall(conv, target) or joinChatCall(room).
import { useEffect, useState } from 'react';
import { Loader2, X, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { appConfirm } from '@/lib/appDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

const OPEN_EVENT = 'ewvon:open-video-call';
const INFO_EVENT = 'ewvon:video-info';
type Req = { kind: 'meeting'; eventId: string } | { kind: 'chat-start'; conv: 'dm' | 'group' | 'sector'; target: string } | { kind: 'chat-join'; room: string };
const fire = (r: Req) => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: r }));
export const openVideoCall = (eventId: string) => fire({ kind: 'meeting', eventId });
export const startChatCall = (conv: 'dm' | 'group' | 'sector', target: string) => fire({ kind: 'chat-start', conv, target });
export const joinChatCall = (room: string) => fire({ kind: 'chat-join', room });
export const openVideoInfo = () => window.dispatchEvent(new Event(INFO_EVENT));

// Chat messages that announce a call: "📹 ewvon-call:<room>".
export const CALL_PREFIX = '📹 ewvon-call:';
export const parseCall = (content?: string | null) => (content && content.startsWith(CALL_PREFIX) ? content.slice(CALL_PREFIX.length).trim() : null);

export function CallMessageCard({ room, own }: { room: string; own?: boolean }) {
  return (
    <div className="flex min-w-[220px] items-center gap-3 rounded-xl border border-border bg-card p-3 text-foreground">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Video className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold">Chamada de vídeo</p><p className="text-[11px] text-muted-foreground">{own ? 'Você iniciou uma chamada' : 'Toque para participar'}</p></div>
      <button type="button" onClick={(e) => { e.stopPropagation(); joinChatCall(room); }} className="shrink-0 rounded-full bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-600">Entrar</button>
    </div>
  );
}

function VideoInfoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [cfg, setCfg] = useState<{ free_minutes: number; price_per_minute: number } | null>(null);
  useEffect(() => { if (open) void (supabase as any).rpc('my_video_usage').then(({ data }: any) => setCfg(data)); }, [open]);
  const free = cfg?.free_minutes ?? 2500;
  const price = Number(cfg?.price_per_minute ?? 0.045);
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 3 });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Como funcionam as videochamadas</DialogTitle><DialogDescription>Reuniões do calendário e chamadas no chat, dentro do ewvon.</DialogDescription></DialogHeader>
        <div className="space-y-3 text-[13px] text-muted-foreground">
          <p><b className="text-foreground">Plano:</b> disponível no plano <b>Empresarial</b>, no PC e no celular, com câmera, microfone, chat e compartilhamento de tela.</p>
          <p><b className="text-foreground">Franquia grátis:</b> {free.toLocaleString('pt-BR')} minutos por mês para a empresa. Conta minuto por participante: uma chamada de 30 minutos com 4 pessoas usa 120 minutos. A franquia renova todo dia 1º.</p>
          <p><b className="text-foreground">Avisos:</b> o administrador principal recebe uma mensagem no chat Comunicados ao chegar em 80%, 90% e 100% da franquia.</p>
          <p><b className="text-foreground">Ao acabar a franquia:</b> novas chamadas ficam bloqueadas até o dia 1º. Se o administrador quiser continuar, ativa em <b>Pagamentos › Videochamadas</b>.</p>
          <p><b className="text-foreground">Minutos extras:</b> {brl(price)} por minuto por participante, somados na <b>próxima fatura</b>. Exemplo: 500 minutos extras = {brl(500 * price)}.</p>
          <p className="text-[12px]">Os valores e a franquia podem mudar; o uso do mês fica sempre visível em Pagamentos.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function VideoCallHost() {
  const [call, setCall] = useState<{ src: string; title: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState(false);

  useEffect(() => {
    const onOpen = async (e: Event) => {
      const r = (e as CustomEvent<Req>).detail;
      setLoading(true);
      try {
        const [route, body] = r.kind === 'meeting' ? ['join', { event_id: r.eventId }] : r.kind === 'chat-start' ? ['chat-start', { conv: r.conv, target: r.target }] : ['chat-join', { room: r.room }];
        const { data, error } = await supabase.functions.invoke(`video/${route}`, { body });
        if (error || !(data as any)?.token) {
          let msg = 'Não foi possível entrar na chamada.';
          try { const b = await (error as any)?.context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
          if ((data as any)?.error) msg = (data as any).error;
          toast.error(msg, /plano Empresarial|minutos grátis/.test(msg) ? { action: { label: 'Saiba mais', onClick: () => setInfo(true) } } : undefined);
          return;
        }
        const d = data as any;
        setCall({ src: `${d.url}?t=${encodeURIComponent(d.token)}`, title: d.title || 'Videochamada' });
      } finally { setLoading(false); }
    };
    const onInfo = () => setInfo(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(INFO_EVENT, onInfo);
    return () => { window.removeEventListener(OPEN_EVENT, onOpen); window.removeEventListener(INFO_EVENT, onInfo); };
  }, []);

  const close = async () => {
    if (await appConfirm({ title: 'Sair da chamada?', message: 'Você pode voltar enquanto a chamada estiver aberta.', confirmText: 'Sair', danger: true })) setCall(null);
  };

  return (
    <>
      <VideoInfoDialog open={info} onOpenChange={setInfo} />
      {loading ? <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 text-white"><Loader2 className="h-7 w-7 animate-spin" /></div> : null}
      {call ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-[#0b0b0e]" role="dialog" aria-label={call.title}>
          <div className="flex h-12 shrink-0 items-center justify-between gap-3 px-4 text-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
            <p className="truncate text-sm font-semibold">{call.title}</p>
            <button type="button" onClick={() => void close()} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Sair da chamada"><X className="h-4 w-4" /></button>
          </div>
          <iframe title={call.title} src={call.src} className="min-h-0 flex-1 border-0" allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write; speaker-selection" />
        </div>
      ) : null}
    </>
  );
}
