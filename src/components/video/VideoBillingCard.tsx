// Pagamentos > Videochamadas: monthly usage against the free allowance, opt-in for paid extra minutes.
import { useCallback, useEffect, useState } from 'react';
import { Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { appConfirm } from '@/lib/appDialog';
import { openVideoInfo } from './VideoCallHost';
import { toast } from 'sonner';

type Usage = { minutes: number; free_minutes: number; price_per_minute: number; overage_allowed: boolean; pending_cents: number };
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 3 });

export function VideoBillingCard({ available }: { available: boolean }) {
  const [u, setU] = useState<Usage | null>(null);
  const load = useCallback(async () => { const { data } = await (supabase as any).rpc('my_video_usage'); setU(data); }, []);
  useEffect(() => { void load(); }, [load]);
  const toggle = async (on: boolean) => {
    if (!u) return;
    if (on && !(await appConfirm({ title: 'Continuar após a franquia grátis?', message: `Quando os ${u.free_minutes.toLocaleString('pt-BR')} minutos do mês acabarem, as chamadas continuam e cada minuto extra por participante custa ${brl(Number(u.price_per_minute))}, somado na próxima fatura. Você pode desligar quando quiser.`, confirmText: 'Ativar' }))) return;
    const { error } = await (supabase as any).rpc('set_video_overage', { _allowed: on });
    if (error) { toast.error('Não foi possível salvar.'); return; }
    toast.success(on ? 'Continuação ativada.' : 'Continuação desligada: ao acabar a franquia, as chamadas param até o dia 1º.');
    void load();
  };
  const pct = u ? Math.min(100, Math.round((u.minutes / Math.max(1, u.free_minutes)) * 100)) : 0;
  const tone = pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-amber-500' : 'bg-foreground';
  return (
    <Card><CardContent className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2"><Video className="h-5 w-5" /><p className="text-[15px] font-semibold">Videochamadas</p></div>
        <button type="button" onClick={openVideoInfo} className="text-[12px] font-medium text-primary underline-offset-2 hover:underline">Saiba mais</button>
      </div>
      {!available ? <p className="text-[13px] text-muted-foreground">Disponível no plano Empresarial: reuniões e chamadas no chat com {(u?.free_minutes ?? 2500).toLocaleString('pt-BR')} minutos grátis por mês.</p> : !u ? null : (
        <>
          <div>
            <div className="flex items-baseline justify-between text-[13px]"><span className="text-muted-foreground">Uso deste mês</span><span className="font-medium tabular-nums">{u.minutes.toLocaleString('pt-BR')} de {u.free_minutes.toLocaleString('pt-BR')} minutos grátis</span></div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full ${tone}`} style={{ width: `${pct}%` }} /></div>
            <p className="mt-1 text-[12px] text-muted-foreground">Atualizado de hora em hora. A franquia renova todo dia 1º.</p>
          </div>
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-[13px] font-medium">Continuar após a franquia</p>
              <p className="text-[12px] text-muted-foreground">{brl(Number(u.price_per_minute))} por minuto extra por participante, cobrado na próxima fatura. Desligado: as chamadas param ao acabar a franquia.</p>
            </div>
            <Switch checked={u.overage_allowed} onCheckedChange={(v) => void toggle(v)} aria-label="Continuar após a franquia" />
          </div>
          {u.pending_cents > 0 ? <p className="text-[13px]">Minutos extras a cobrar na próxima fatura: <b>{brl(u.pending_cents / 100)}</b></p> : null}
        </>
      )}
    </CardContent></Card>
  );
}
