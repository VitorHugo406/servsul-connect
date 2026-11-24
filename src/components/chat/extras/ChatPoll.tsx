// Polls in conversations and announcements. A chat poll is a message "ewvon-poll:<uuid>" rendered as PollCard;
// an announcement poll uses context 'announcement' + the announcement id. Votes go through poll_vote (one row per
// option; changing the vote replaces it) and results through poll_results, which hides names on anonymous polls.
// Needs the polls tables (migration 20261121010000); without them the card says it is unavailable.
import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDbFeature } from '@/hooks/useDbFeature';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { appConfirm } from '@/lib/appDialog';
import { cn } from '@/lib/utils';
import '@/styles/chat-extras.css';

const db = supabase as any;
const RE = /^ewvon-poll:([0-9a-f-]{36})$/;
export const parsePoll = (c: string | null | undefined) => (c ? (String(c).trim().match(RE)?.[1] ?? null) : null);
export const pollContent = (id: string) => `ewvon-poll:${id}`;

type Results = { id: string; question: string; options: string[]; multi: boolean; anonymous: boolean; closes_at: string | null; closed: boolean; created_by: string; author: string; counts: number[]; voters: number; mine: number[]; names: Record<string, string[]> | null };
export type PollDraft = { question: string; options: string[]; multi: boolean; anonymous: boolean; hours: number };
export const emptyPoll = (): PollDraft => ({ question: '', options: ['', ''], multi: false, anonymous: false, hours: 0 });
export const pollReady = (d: PollDraft) => d.question.trim().length > 0 && d.options.filter((o) => o.trim()).length >= 2;

export async function createPoll(context: 'chat' | 'announcement', key: string, d: PollDraft): Promise<string> {
  const options = d.options.map((o) => o.trim()).filter(Boolean).slice(0, 10);
  const { data, error } = await db.from('polls').insert({
    context, context_key: key, question: d.question.trim().slice(0, 300), options, multi: d.multi, anonymous: d.anonymous,
    closes_at: d.hours > 0 ? new Date(Date.now() + d.hours * 36e5).toISOString() : null,
  }).select('id').single();
  if (error || !data) throw error || new Error('poll');
  return data.id as string;
}

/** The question/options/settings fields, used by the chat dialog and inside the announcement form. */
export function PollEditor({ value, onChange }: { value: PollDraft; onChange: (d: PollDraft) => void }) {
  const set = (p: Partial<PollDraft>) => onChange({ ...value, ...p });
  const ENDS: [number, string][] = [[0, 'Sem prazo'], [1, '1 hora'], [24, '24 horas'], [72, '3 dias'], [168, '7 dias']];
  return (
    <div className="cx-form cx-pform">
      <div><label className="cx-l" htmlFor="cx-poll-q">Pergunta</label><Input id="cx-poll-q" value={value.question} maxLength={300} placeholder="Ex.: Qual o melhor dia para a reunião?" onChange={(e) => set({ question: e.target.value })} /></div>
      <div>
        <label className="cx-l">Opções</label>
        <div className="cx-popts">
          {value.options.map((o, i) => (
            <div key={i} className="cx-optrow">
              <span className={cn('cx-pdot', value.multi && 'sq')} aria-hidden="true" />
              <Input value={o} maxLength={120} placeholder={`Opção ${i + 1}`} aria-label={`Opção ${i + 1}`} onChange={(e) => { const opts = [...value.options]; opts[i] = e.target.value; set({ options: opts }); }} />
              {value.options.length > 2 ? <button type="button" className="cx-iconbtn" aria-label={`Remover opção ${i + 1}`} onClick={() => set({ options: value.options.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button> : null}
            </div>
          ))}
          {value.options.length < 10 ? <button type="button" className="cx-padd" onClick={() => set({ options: [...value.options, ''] })}><Plus className="h-4 w-4" />Adicionar opção</button> : null}
        </div>
      </div>
      <div className="cx-psets">
        <label className="cx-pset"><span><b>Várias respostas</b><small>Cada pessoa pode marcar mais de uma opção</small></span><Switch checked={value.multi} onCheckedChange={(v) => set({ multi: v })} /></label>
        <label className="cx-pset"><span><b>Votos anônimos</b><small>Ninguém vê quem votou em cada opção, só os totais</small></span><Switch checked={value.anonymous} onCheckedChange={(v) => set({ anonymous: v })} /></label>
      </div>
      <div>
        <label className="cx-l">Encerrar votação</label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Encerrar a enquete">
          {ENDS.map(([h, l]) => <button key={h} type="button" className="ui-chip" aria-pressed={value.hours === h} onClick={() => set({ hours: h })}>{l}</button>)}
        </div>
      </div>
    </div>
  );
}

/** "Criar enquete" dialog of the chat composer. */
export function CreatePollDialog({ open, onOpenChange, convKey, onSend }: { open: boolean; onOpenChange: (o: boolean) => void; convKey: string | null; onSend: (content: string) => unknown }) {
  const [d, setD] = useState<PollDraft>(emptyPoll);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setD(emptyPoll()); }, [open]);
  const send = async () => {
    if (!convKey || !pollReady(d)) return;
    setBusy(true);
    try { const id = await createPoll('chat', convKey, d); await onSend(pollContent(id)); onOpenChange(false); }
    catch { toast.error('Não foi possível criar a enquete.'); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Criar enquete</DialogTitle><DialogDescription>Todos da conversa podem votar e ver o resultado na hora, como no WhatsApp.</DialogDescription></DialogHeader>
        <PollEditor value={d} onChange={setD} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={() => void send()} disabled={busy || !pollReady(d)}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}Enviar enquete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PollCard({ id }: { id: string }) {
  const { profile } = useAuth();
  const has = useDbFeature('polls');
  const [r, setR] = useState<Results | null | 'gone'>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await db.rpc('poll_results', { _poll: id });
    if (error || !data) { setR('gone'); return; }
    setR({ ...data, options: (data.options || []).map(String) });
  }, [id]);
  useEffect(() => {
    if (!has) return;
    void load();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 20000);
    return () => window.clearInterval(t);
  }, [has, load]);

  if (!has || r === 'gone') return <div className="cx-poll"><div className="cx-poll-q"><BarChart3 className="mr-1 inline h-4 w-4" />Enquete</div><div className="cx-poll-meta">{has ? 'Esta enquete não está mais disponível.' : 'Enquetes ainda não estão ativas nesta empresa.'}</div></div>;
  if (!r) return <div className="cx-poll"><Loader2 className="h-4 w-4 animate-spin opacity-60" /></div>;

  const mine = new Set(r.mine);
  const vote = async (idx: number) => {
    if (r.closed || busy) return;
    const next = r.multi ? (mine.has(idx) ? r.mine.filter((x) => x !== idx) : [...r.mine, idx]) : (mine.has(idx) ? [] : [idx]);
    setBusy(true);
    const { error } = await db.rpc('poll_vote', { _poll: r.id, _options: next });
    setBusy(false);
    if (error) { toast.error(/POLL_CLOSED/.test(error.message) ? 'A enquete já foi encerrada.' : 'Não foi possível registrar o voto.'); }
    void load();
  };
  const close = async () => {
    if (!(await appConfirm({ title: 'Encerrar enquete?', message: 'Ninguém mais poderá votar. O resultado continua visível.', confirmText: 'Encerrar' }))) return;
    const { error } = await db.rpc('poll_close', { _poll: r.id });
    if (error) toast.error('Não foi possível encerrar.'); else void load();
  };
  const total = Math.max(r.voters, 1);
  const closesTxt = r.closed ? 'Encerrada' : r.closes_at ? `Encerra ${new Date(r.closes_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : null;
  return (
    <div className={cn('cx-poll', r.multi && 'is-multi')}>
      <div className="cx-poll-q"><BarChart3 className="mr-1 inline h-4 w-4 align-[-2px]" />{r.question}</div>
      <div className="cx-poll-meta">{r.multi ? 'Escolha uma ou mais opções' : 'Escolha uma opção'}{r.anonymous ? ' · Votos anônimos' : ''}</div>
      <div className="flex flex-col gap-1.5" role="group" aria-label={r.question}>
        {r.options.map((o, i) => {
          const c = r.counts[i] || 0; const pct = Math.round((c / total) * 100); const on = mine.has(i);
          return (
            <button key={i} type="button" className={cn('cx-opt', on && 'is-mine')} disabled={r.closed || busy} aria-pressed={on} onClick={() => void vote(i)}>
              <span className="cx-fill" style={{ width: `${r.voters ? pct : 0}%` }} />
              <span className="cx-box">{on ? <Check className="h-3 w-3" /> : null}</span>
              <span className="cx-lbl">{o}</span>
              <span className="cx-pct">{r.voters ? `${pct}%` : ''}</span>
            </button>
          );
        })}
      </div>
      <div className="cx-poll-foot">
        <span className="opacity-75">{r.voters === 1 ? '1 voto' : `${r.voters} votos`}{closesTxt ? ` · ${closesTxt}` : ''}</span>
        <span className="flex-1" />
        {!r.anonymous && r.voters > 0 ? (
          <Popover>
            <PopoverTrigger asChild><button type="button" className="cx-link">Ver votos</button></PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3">
              <div className="cx-voters">
                {r.options.map((o, i) => (
                  <div key={i}><h4>{o} · {r.counts[i] || 0}</h4><p>{(r.names?.[String(i)] || []).join(', ') || 'Ninguém ainda'}</p></div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
        {!r.closed && r.created_by === profile?.id ? <button type="button" className="cx-link" onClick={() => void close()}>Encerrar</button> : null}
      </div>
    </div>
  );
}
