// Scheduled messages ("Agendar mensagem" in the composer "+" menu). Rows live in scheduled_messages (migration
// 20261121010000); the cron job send_scheduled_messages() posts them every minute as the author, in the same
// conversation, checking that the author still has access. Each person only sees their own scheduled messages.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDbFeature } from '@/hooks/useDbFeature';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import '@/styles/chat-extras.css';

const db = supabase as any;
type Row = { id: string; content: string; send_at: string; status: 'pending' | 'sent' | 'cancelled' | 'failed'; error: string | null };
const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function useScheduledMessages(convKey: string | null) {
  const has = useDbFeature('scheduled_messages');
  const [rows, setRows] = useState<Row[]>([]);
  const load = useCallback(async () => {
    if (!has || !convKey) { setRows([]); return; }
    const { data } = await db.from('scheduled_messages').select('id,content,send_at,status,error').eq('conv_key', convKey).in('status', ['pending', 'failed'])
      .gte('send_at', new Date(Date.now() - 7 * 864e5).toISOString()).order('send_at').limit(50);
    setRows(data || []);
  }, [has, convKey]);
  useEffect(() => {
    void load();
    if (!has || !convKey) return;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60000);
    return () => window.clearInterval(t);
  }, [load, has, convKey]);
  return { enabled: has && !!convKey, rows, pending: rows.filter((r) => r.status === 'pending').length, reload: load };
}

export function ScheduleMessageDialog({ open, onOpenChange, convKey, initialText, rows, onChanged, onScheduled }: { open: boolean; onOpenChange: (o: boolean) => void; convKey: string | null; initialText?: string; rows: Row[]; onChanged: () => void; onScheduled?: () => void }) {
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const d = new Date(Date.now() + 60 * 60000); d.setMinutes(0, 0, 0);
    setText(initialText || ''); setDate(toDate(d)); setTime(toTime(d));
  }, [open, initialText]);
  const quick = useMemo(() => {
    const now = new Date();
    const inHour = new Date(now.getTime() + 60 * 60000);
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
    const monday = new Date(now); monday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7)); monday.setHours(9, 0, 0, 0);
    return [{ label: 'Em 1 hora', d: inHour }, { label: 'Amanhã às 9h', d: tomorrow }, { label: 'Segunda às 9h', d: monday }];
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const when = date && time ? new Date(`${date}T${time}:00`) : null;
  const valid = !!when && !isNaN(+when) && +when > Date.now() + 30000 && +when < Date.now() + 365 * 864e5;
  const save = async () => {
    if (!convKey || !valid || !text.trim()) return;
    setBusy(true);
    const { error } = await db.from('scheduled_messages').insert({ conv_key: convKey, content: text.trim().slice(0, 4000), send_at: when!.toISOString() });
    setBusy(false);
    if (error) { toast.error('Não foi possível agendar. Confira a data e se você pode enviar nesta conversa.'); return; }
    toast.success(`Mensagem agendada para ${when!.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`);
    setText(''); onChanged(); onScheduled?.();
  };
  const cancel = async (r: Row) => {
    const q = r.status === 'pending' ? db.from('scheduled_messages').update({ status: 'cancelled' }).eq('id', r.id) : db.from('scheduled_messages').delete().eq('id', r.id);
    const { error } = await q;
    if (error) toast.error('Não foi possível cancelar.'); else onChanged();
  };
  const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Agendar mensagem</DialogTitle><DialogDescription>A mensagem é enviada em seu nome no dia e hora escolhidos, nesta conversa.</DialogDescription></DialogHeader>
        <div className="cx-form">
          <div><label className="cx-l" htmlFor="cx-sched-text">Mensagem</label><Textarea id="cx-sched-text" rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva a mensagem" /></div>
          <div className="flex flex-wrap gap-1.5">{quick.map((q) => <button key={q.label} type="button" className="cx-chip" onClick={() => { setDate(toDate(q.d)); setTime(toTime(q.d)); }}>{q.label}</button>)}</div>
          <div className="cx-two">
            <div><label className="cx-l" htmlFor="cx-sched-date">Dia</label><Input id="cx-sched-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className="cx-l" htmlFor="cx-sched-time">Hora</label><Input id="cx-sched-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          {when && !valid ? <p className="cx-hint text-destructive">Escolha um horário no futuro (até 1 ano).</p> : null}
          {rows.length ? <>
            <label className="cx-l">Agendadas nesta conversa</label>
            <div className="cx-sched-list">
              {rows.map((r) => (
                <div key={r.id} className={cn('cx-sched-item', r.status === 'failed' && 'is-failed')}>
                  <span className="cx-when">{r.status === 'failed' ? 'Não enviada' : fmt(r.send_at)}</span>
                  <span className="cx-what">{r.content}</span>
                  <button type="button" className="cx-iconbtn" onClick={() => void cancel(r)} aria-label={r.status === 'pending' ? 'Cancelar agendamento' : 'Remover'} title={r.status === 'pending' ? 'Cancelar' : 'Remover'}>{r.status === 'pending' ? <X className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}</button>
                </div>
              ))}
            </div>
          </> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Fechar</Button>
          <Button onClick={() => void save()} disabled={busy || !valid || !text.trim()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}Agendar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
