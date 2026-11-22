// "Link de agendamento" (Calendário): each person can publish /agendar/<token>, where people outside the company pick a
// free time in their agenda (days of the week, hours, duration, interval, minimum notice, how many days ahead). Free
// times are computed on the server from the person's calendar events and room bookings (booking_free_slots), and a
// booking creates a normal calendar event + a bell notification. Table booking_pages (migration 20261121010000).
import { useEffect, useState } from 'react';
import { CalendarCheck2, Copy, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDbFeature } from '@/hooks/useDbFeature';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Sel } from '@/components/ui/Sel';
import { appConfirm } from '@/lib/appDialog';
import '@/styles/chat-extras.css';

const db = supabase as any;
type Page = { id: string; token: string; enabled: boolean; title: string; intro: string | null; duration_min: number; weekdays: number[]; start_time: string; end_time: string; buffer_min: number; min_notice_hours: number; max_days_ahead: number; meeting_link: string | null };
type Booking = { id: string; guest_name: string; guest_email: string; starts_at: string; created_at: string };
const DAYS = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [7, 'Dom']] as const;
const durLabel = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');

export function BookingPageButton({ className }: { className?: string }) {
  const has = useDbFeature('booking_pages');
  const [open, setOpen] = useState(false);
  const [p, setP] = useState<Page | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Booking[]>([]);
  useEffect(() => {
    if (!open || !has) return;
    setLoading(true);
    void (async () => {
      let { data } = await db.from('booking_pages').select('*').maybeSingle();
      if (!data) { const r = await db.from('booking_pages').insert({ enabled: false }).select('*').single(); data = r.data; }
      setP(data || null);
      if (data) { const { data: b } = await db.from('public_bookings').select('id,guest_name,guest_email,starts_at,created_at').eq('page_id', data.id).order('created_at', { ascending: false }).limit(8); setRecent(b || []); }
      setLoading(false);
    })();
  }, [open, has]);
  if (!has) return null;
  const set = (x: Partial<Page>) => setP((v) => (v ? { ...v, ...x } : v));
  const url = p ? `${window.location.origin}/agendar/${p.token}` : '';
  const valid = !!p && p.title.trim().length > 0 && p.weekdays.length > 0 && p.end_time > p.start_time && (!p.meeting_link || /^https:\/\//.test(p.meeting_link));
  const save = async () => {
    if (!p || !valid) return;
    setBusy(true);
    const { error } = await db.from('booking_pages').update({ enabled: p.enabled, title: p.title.trim(), intro: p.intro?.trim() || null, duration_min: p.duration_min, weekdays: [...p.weekdays].sort(), start_time: p.start_time, end_time: p.end_time, buffer_min: p.buffer_min, min_notice_hours: p.min_notice_hours, max_days_ahead: p.max_days_ahead, meeting_link: p.meeting_link?.trim() || null, updated_at: new Date().toISOString() }).eq('id', p.id);
    setBusy(false);
    if (error) { toast.error('Não foi possível salvar. Confira os horários e o link da reunião (precisa começar com https://).'); return; }
    toast.success(p.enabled ? 'Link de agendamento salvo e ativo' : 'Configuração salva (link pausado)'); setOpen(false);
  };
  const regen = async () => {
    if (!p || !(await appConfirm({ title: 'Gerar um novo link?', message: 'O link atual para de funcionar na hora. Quem já agendou continua agendado.', confirmText: 'Gerar novo link' }))) return;
    const token = hex(12);
    const { error } = await db.from('booking_pages').update({ token }).eq('id', p.id);
    if (error) toast.error('Não foi possível gerar outro link.'); else { set({ token }); toast.success('Novo link gerado'); }
  };
  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => setOpen(true)}><CalendarCheck2 className="mr-1 h-3.5 w-3.5" />Link de agendamento</Button>
      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Link de agendamento</DialogTitle>
            <DialogDescription>Quem tiver o link escolhe um horário livre na sua agenda. A reunião entra no seu calendário e você recebe um aviso.</DialogDescription>
          </DialogHeader>
          {loading || !p ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
            <div className="cx-form max-h-[62vh] overflow-auto pr-1">
              <div className="flex items-center gap-3"><Switch id="bk-on" checked={p.enabled} onCheckedChange={(v) => set({ enabled: v })} /><label htmlFor="bk-on" className="text-sm font-medium">{p.enabled ? 'Link ativo' : 'Link pausado'}</label></div>
              <div className="flex items-center gap-1.5">
                <Input readOnly value={url} aria-label="Link público" onFocus={(e) => e.currentTarget.select()} />
                <Button variant="outline" size="icon" title="Copiar" aria-label="Copiar link" onClick={() => void navigator.clipboard?.writeText(url).then(() => toast.success('Link copiado'))}><Copy className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" title="Abrir" aria-label="Abrir link" onClick={() => window.open(url, '_blank', 'noopener')}><ExternalLink className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" title="Gerar novo link" aria-label="Gerar novo link" onClick={() => void regen()}><RefreshCw className="h-4 w-4" /></Button>
              </div>
              <div><label className="cx-l" htmlFor="bk-title">Nome da reunião</label><Input id="bk-title" value={p.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} /></div>
              <div><label className="cx-l" htmlFor="bk-intro">Mensagem para quem agenda</label><Textarea id="bk-intro" rows={2} maxLength={1000} value={p.intro || ''} onChange={(e) => set({ intro: e.target.value })} placeholder="Ex.: Conversa de 30 minutos para conhecer o seu projeto." /></div>
              <div>
                <label className="cx-l">Dias da semana</label>
                <div className="flex flex-wrap gap-1.5">{DAYS.map(([d, l]) => { const on = p.weekdays.includes(d); return <button key={d} type="button" className="ui-chip" aria-pressed={on} onClick={() => set({ weekdays: on ? p.weekdays.filter((x) => x !== d) : [...p.weekdays, d] })}>{l}</button>; })}</div>
              </div>
              <div className="cx-two">
                <div><label className="cx-l" htmlFor="bk-from">Das</label><Input id="bk-from" type="time" value={p.start_time.slice(0, 5)} onChange={(e) => set({ start_time: e.target.value })} /></div>
                <div><label className="cx-l" htmlFor="bk-to">Até</label><Input id="bk-to" type="time" value={p.end_time.slice(0, 5)} onChange={(e) => set({ end_time: e.target.value })} /></div>
              </div>
              <div className="cx-two">
                <div><label className="cx-l">Duração</label><Sel className="ui-sel w-full" value={String(p.duration_min)} onChange={(e) => set({ duration_min: Number(e.target.value) })} aria-label="Duração">{[15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{durLabel(m)}</option>)}</Sel></div>
                <div><label className="cx-l">Intervalo entre reuniões</label><Sel className="ui-sel w-full" value={String(p.buffer_min)} onChange={(e) => set({ buffer_min: Number(e.target.value) })} aria-label="Intervalo">{[0, 5, 10, 15, 30].map((m) => <option key={m} value={m}>{m ? `${m} min` : 'Sem intervalo'}</option>)}</Sel></div>
              </div>
              <div className="cx-two">
                <div><label className="cx-l">Antecedência mínima</label><Sel className="ui-sel w-full" value={String(p.min_notice_hours)} onChange={(e) => set({ min_notice_hours: Number(e.target.value) })} aria-label="Antecedência">{[0, 1, 2, 4, 12, 24, 48].map((h) => <option key={h} value={h}>{h ? `${h} h` : 'Nenhuma'}</option>)}</Sel></div>
                <div><label className="cx-l">Agendar até</label><Sel className="ui-sel w-full" value={String(p.max_days_ahead)} onChange={(e) => set({ max_days_ahead: Number(e.target.value) })} aria-label="Dias à frente">{[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} dias à frente</option>)}</Sel></div>
              </div>
              <div><label className="cx-l" htmlFor="bk-link">Link da reunião on-line (opcional)</label><Input id="bk-link" value={p.meeting_link || ''} onChange={(e) => set({ meeting_link: e.target.value })} placeholder="https://..." /><p className="cx-hint">Aparece para quem agendou e no evento do seu calendário.</p></div>
              {recent.length ? <div><label className="cx-l">Últimos agendamentos</label>
                <div className="flex flex-col gap-1">{recent.map((b) => <div key={b.id} className="flex items-center justify-between gap-2 rounded-[10px] bg-muted/50 px-3 py-2 text-sm"><span className="min-w-0 truncate"><b className="font-medium">{b.guest_name}</b> · {b.guest_email}</span><span className="shrink-0 text-xs text-muted-foreground">{new Date(b.starts_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>)}</div></div> : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Fechar</Button>
            <Button onClick={() => void save()} disabled={busy || !valid}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
