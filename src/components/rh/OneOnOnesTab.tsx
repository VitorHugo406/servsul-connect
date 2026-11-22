// Reuniões 1:1: the manager schedules (the person is notified), both add topics to the agenda before the meeting,
// write shared notes and action items, and each one keeps private notes only they see. History per person.
// one_on_ones + one_on_one_private_notes (migration 20261121010000).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sel } from '@/components/ui/Sel';
import { appConfirm } from '@/lib/appDialog';
import { Av, db, fmtDH, pname, usePeople } from './rhShared';
import '@/styles/chat-extras.css';

type Item = { id: string; text: string; by?: string; done?: boolean; owner?: string | null };
type O = { id: string; manager_id: string; employee_id: string; scheduled_at: string; status: 'scheduled' | 'done' | 'cancelled'; agenda: Item[]; shared_notes: string | null; action_items: Item[] };
const rid = () => Math.random().toString(36).slice(2, 9);

export function OneOnOnesTab({ isManager }: { isManager: boolean }) {
  const { profile } = useAuth();
  const { list: people, byId } = usePeople();
  const [rows, setRows] = useState<O[] | null>(null);
  const [open, setOpen] = useState<O | null>(null);
  const [create, setCreate] = useState(false);
  const [who, setWho] = useState(''); const [when, setWhen] = useState('');
  const load = useCallback(async () => { const { data } = await db.from('one_on_ones').select('*').order('scheduled_at', { ascending: false }).limit(200); setRows(data || []); }, []);
  useEffect(() => { void load(); }, [load]);
  const now = Date.now();
  const upcoming = (rows || []).filter((r) => r.status === 'scheduled' && +new Date(r.scheduled_at) >= now - 3 * 36e5).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const past = (rows || []).filter((r) => !upcoming.includes(r));
  const other = (r: O) => byId.get(r.manager_id === profile?.id ? r.employee_id : r.manager_id);
  const schedule = async () => {
    if (!who || !when) return;
    const { error } = await db.from('one_on_ones').insert({ manager_id: profile?.id, employee_id: who, scheduled_at: new Date(when).toISOString() });
    if (error) { toast.error('Você só pode marcar 1:1 com pessoas que você gerencia (equipe ou setor).'); return; }
    toast.success('1:1 marcada. A pessoa foi avisada.'); setCreate(false); setWho(''); setWhen(''); void load();
  };
  const ST: Record<string, [string, string]> = { scheduled: ['Agendada', 'dk-c-a'], done: ['Realizada', 'dk-c-g'], cancelled: ['Cancelada', 'dk-c-n'] };
  const rowEl = (r: O) => { const p = other(r); const [l, c] = ST[r.status]; return (
    <div key={r.id} className="dk-it" style={{ cursor: 'pointer' }} onClick={() => setOpen(r)}>
      <Av p={p} size={40} />
      <div className="dk-nm"><div className="dk-ti">{pname(p)}</div><div className="dk-su">{fmtDH(r.scheduled_at)} · {r.manager_id === profile?.id ? 'você é o(a) gestor(a)' : 'com seu gestor(a)'} · {r.agenda.length} assunto(s) na pauta</div></div>
      <span className={`dk-chp ${c}`}>{l}</span>
    </div>); };
  return (
    <div className="flex flex-col">
      <div className="dk-bar"><div className="dk-ti" style={{ fontSize: 15 }}>Próximas 1:1</div>{isManager ? <div className="dk-flt"><button type="button" className="dk-btn pri" onClick={() => { const d = new Date(Date.now() + 864e5); d.setHours(10, 0, 0, 0); setWhen(new Date(+d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)); setCreate(true); }}><Plus size={16} />Marcar 1:1</button></div> : null}</div>
      {rows === null ? <div className="dk-empty"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : upcoming.length ? upcoming.map(rowEl) : <div className="dk-empty">Nenhuma 1:1 marcada.</div>}
      {past.length ? <><div className="dk-gh">Histórico</div>{past.slice(0, 60).map(rowEl)}</> : null}
      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Marcar 1:1</DialogTitle><DialogDescription>A pessoa recebe um aviso e pode adicionar assuntos à pauta.</DialogDescription></DialogHeader>
          <div className="cx-form">
            <div><label className="cx-l">Com quem</label><Sel className="ui-sel w-full" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Pessoa"><option value="">Escolha a pessoa</option>{people.filter((p) => p.id !== profile?.id).map((p) => <option key={p.id} value={p.id}>{pname(p)}</option>)}</Sel></div>
            <div><label className="cx-l" htmlFor="oo-when">Quando</label><Input id="oo-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreate(false)}>Cancelar</Button><Button onClick={() => void schedule()} disabled={!who || !when}>Marcar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <OneOnOneDialog o={open} onClose={() => setOpen(null)} onChanged={() => void load()} />
    </div>
  );
}

function OneOnOneDialog({ o, onClose, onChanged }: { o: O | null; onClose: () => void; onChanged: () => void }) {
  const { profile } = useAuth();
  const { list: people, byId } = usePeople();
  const [x, setX] = useState<O | null>(null);
  const [priv, setPriv] = useState('');
  const [topic, setTopic] = useState(''); const [act, setAct] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setX(o ? { ...o, agenda: [...(o.agenda || [])], action_items: [...(o.action_items || [])] } : null); setPriv(''); setTopic(''); setAct('');
    if (o) void db.from('one_on_one_private_notes').select('notes').eq('one_on_one_id', o.id).maybeSingle().then(({ data }: any) => setPriv(data?.notes || ''));
  }, [o]);
  const pair = useMemo(() => (x ? [byId.get(x.manager_id), byId.get(x.employee_id)] : []), [x, byId]);
  if (!x) return null;
  const isMgr = x.manager_id === profile?.id;
  const save = async (status?: O['status']) => {
    setBusy(true);
    const { error } = await db.from('one_on_ones').update({ agenda: x.agenda, shared_notes: x.shared_notes || null, action_items: x.action_items, ...(status ? { status } : {}) }).eq('id', x.id);
    const pr = await db.from('one_on_one_private_notes').upsert({ one_on_one_id: x.id, notes: priv || null, updated_at: new Date().toISOString() }, { onConflict: 'one_on_one_id,author_id' });
    setBusy(false);
    if (error || pr.error) { toast.error('Não foi possível salvar.'); return; }
    toast.success(status === 'done' ? '1:1 marcada como realizada' : 'Salvo'); onChanged(); onClose();
  };
  const del = async () => {
    if (!(await appConfirm({ title: 'Excluir esta 1:1?', message: 'A pauta e as anotações compartilhadas serão apagadas.', confirmText: 'Excluir', danger: true }))) return;
    const { error } = await db.from('one_on_ones').delete().eq('id', x.id);
    if (error) toast.error('Não foi possível excluir.'); else { onChanged(); onClose(); }
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>1:1 · {pname(pair[0])} e {pname(pair[1])}</DialogTitle><DialogDescription>{fmtDH(x.scheduled_at)}</DialogDescription></DialogHeader>
        <div className="cx-form max-h-[62vh] overflow-auto pr-1">
          <div>
            <label className="cx-l">Pauta</label>
            <div className="flex flex-col gap-1">{x.agenda.map((it) => <div key={it.id} className="flex items-center gap-2 rounded-[10px] bg-muted/50 px-3 py-1.5 text-sm"><span className="flex-1">{it.text}</span><span className="text-[11px] text-muted-foreground">{pname(byId.get(it.by || ''))}</span><button type="button" className="cx-iconbtn" aria-label="Remover assunto" onClick={() => setX({ ...x, agenda: x.agenda.filter((a) => a.id !== it.id) })}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>
            <div className="mt-1.5 flex gap-1.5"><Input value={topic} maxLength={300} onChange={(e) => setTopic(e.target.value)} placeholder="Adicionar assunto" onKeyDown={(e) => { if (e.key === 'Enter' && topic.trim()) { setX({ ...x, agenda: [...x.agenda, { id: rid(), text: topic.trim(), by: profile?.id }] }); setTopic(''); } }} /><Button type="button" variant="outline" size="icon" aria-label="Adicionar assunto" disabled={!topic.trim()} onClick={() => { setX({ ...x, agenda: [...x.agenda, { id: rid(), text: topic.trim(), by: profile?.id }] }); setTopic(''); }}><Plus className="h-4 w-4" /></Button></div>
          </div>
          <div><label className="cx-l" htmlFor="oo-notes">Anotações compartilhadas</label><Textarea id="oo-notes" rows={5} value={x.shared_notes || ''} onChange={(e) => setX({ ...x, shared_notes: e.target.value })} placeholder="O que conversaram" /></div>
          <div>
            <label className="cx-l">Combinados</label>
            <div className="flex flex-col gap-1">{x.action_items.map((it) => <div key={it.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!it.done} onChange={(e) => setX({ ...x, action_items: x.action_items.map((a) => (a.id === it.id ? { ...a, done: e.target.checked } : a)) })} aria-label="Concluído" />
              <span className={`flex-1 ${it.done ? 'text-muted-foreground line-through' : ''}`}>{it.text}</span>
              <Sel className="ui-sel" value={it.owner || ''} onChange={(e) => setX({ ...x, action_items: x.action_items.map((a) => (a.id === it.id ? { ...a, owner: e.target.value || null } : a)) })} aria-label="Responsável"><option value="">Responsável</option>{people.filter((p) => p.id === x.manager_id || p.id === x.employee_id).map((p) => <option key={p.id} value={p.id}>{pname(p)}</option>)}</Sel>
              <button type="button" className="cx-iconbtn" aria-label="Remover" onClick={() => setX({ ...x, action_items: x.action_items.filter((a) => a.id !== it.id) })}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>)}</div>
            <div className="mt-1.5 flex gap-1.5"><Input value={act} maxLength={300} onChange={(e) => setAct(e.target.value)} placeholder="Adicionar combinado" onKeyDown={(e) => { if (e.key === 'Enter' && act.trim()) { setX({ ...x, action_items: [...x.action_items, { id: rid(), text: act.trim(), owner: null, done: false }] }); setAct(''); } }} /><Button type="button" variant="outline" size="icon" aria-label="Adicionar combinado" disabled={!act.trim()} onClick={() => { setX({ ...x, action_items: [...x.action_items, { id: rid(), text: act.trim(), owner: null, done: false }] }); setAct(''); }}><Plus className="h-4 w-4" /></Button></div>
          </div>
          <div><label className="cx-l" htmlFor="oo-priv"><Lock className="mr-1 inline h-3.5 w-3.5" />Minhas anotações privadas</label><Textarea id="oo-priv" rows={3} value={priv} onChange={(e) => setPriv(e.target.value)} placeholder="Só você vê" /></div>
        </div>
        <DialogFooter>
          {isMgr ? <Button variant="outline" onClick={() => void del()} disabled={busy}>Excluir</Button> : null}
          <span className="flex-1" />
          {x.status === 'scheduled' ? <Button variant="outline" onClick={() => void save('done')} disabled={busy}><Check className="mr-2 h-4 w-4" />Marcar como realizada</Button> : null}
          <Button onClick={() => void save()} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
