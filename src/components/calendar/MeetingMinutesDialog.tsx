// "Pauta e ata" of a meeting (calendar event or meeting-room booking), shared by everyone who can see the meeting:
// agenda before, minutes during/after, and action items (what, who, when) that become cards in a chosen mural.
// One row per meeting in meeting_minutes (migration 20261121010000; useDbFeature hides the button until it exists).
import { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardList, ListPlus, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sel } from '@/components/ui/Sel';
import * as CT from '@/lib/chatTasks';
import '@/styles/chat-extras.css';

const db = supabase as any;
type Action = { id: string; text: string; owner: string | null; due: string | null; card_id: string | null; card_number?: number | null };
const rid = () => Math.random().toString(36).slice(2, 10);

export function MeetingMinutesDialog({ kind, refId, title, open, onOpenChange }: { kind: 'event' | 'booking'; refId: string | null; title: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { profile } = useAuth();
  const { users } = useActiveUsers();
  const people = useMemo(() => {
    const list = [...(users || [])] as { id: string; name: string; display_name?: string | null }[];
    if (profile && !list.some((u) => u.id === profile.id)) list.unshift({ id: profile.id, name: profile.name, display_name: profile.display_name });
    return list;
  }, [users, profile]);
  const [loaded, setLoaded] = useState(false);
  const [agenda, setAgenda] = useState('');
  const [minutes, setMinutes] = useState('');
  const [actions, setActions] = useState<Action[]>([]);
  const [busy, setBusy] = useState(false);
  const [boards, setBoards] = useState<CT.ChatBoard[]>([]);
  const [boardId, setBoardId] = useState('');
  const [cols, setCols] = useState<CT.ChatColumn[]>([]);
  const [colId, setColId] = useState('');

  useEffect(() => {
    if (!open || !refId) return;
    setLoaded(false);
    void (async () => {
      const { data } = await db.from('meeting_minutes').select('agenda,minutes,actions').eq('kind', kind).eq('ref_id', refId).maybeSingle();
      setAgenda(data?.agenda || ''); setMinutes(data?.minutes || ''); setActions(Array.isArray(data?.actions) ? data.actions : []);
      setLoaded(true);
    })();
    void CT.listBoards().then((b) => { setBoards(b); setBoardId((x) => x || b[0]?.id || ''); }).catch(() => setBoards([]));
  }, [open, kind, refId]);
  useEffect(() => {
    if (!boardId) { setCols([]); return; }
    void CT.listColumns(boardId).then((c) => { setCols(c); setColId((c.find((x) => !x.is_conclusion) || c[0])?.id || ''); }).catch(() => setCols([]));
  }, [boardId]);

  const save = async (next?: Action[]) => {
    if (!refId) return false;
    const { error } = await db.from('meeting_minutes').upsert({ kind, ref_id: refId, agenda: agenda || null, minutes: minutes || null, actions: next || actions, updated_at: new Date().toISOString() }, { onConflict: 'kind,ref_id' });
    if (error) { toast.error('Não foi possível salvar a pauta e a ata.'); return false; }
    return true;
  };
  const setA = (id: string, p: Partial<Action>) => setActions((list) => list.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const pending = actions.filter((a) => a.text.trim() && !a.card_id);

  const toCards = async () => {
    const column = cols.find((c) => c.id === colId);
    if (!profile?.id || !boardId || !column || !pending.length) return;
    setBusy(true);
    const next = [...actions]; let ok = 0;
    for (const a of pending) {
      try {
        const t = await CT.createTask({ boardId, column, title: a.text.trim(), description: `Ação da reunião “${title}”.${minutes.trim() ? `\n\nAta:\n${minutes.trim().slice(0, 1500)}` : ''}`, assignedTo: a.owner, dueDate: a.due ? `${a.due}T21:00:00Z` : null, meProfileId: profile.id });
        const i = next.findIndex((x) => x.id === a.id); if (i >= 0) next[i] = { ...next[i], card_id: t.id, card_number: t.task_number };
        ok += 1;
      } catch { /* reported below */ }
    }
    setActions(next);
    await save(next);
    setBusy(false);
    if (ok) toast.success(ok === 1 ? '1 card criado' : `${ok} cards criados`);
    if (ok < pending.length) toast.error(`${pending.length - ok} ação(ões) não viraram card.`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pauta e ata</DialogTitle>
          <DialogDescription>{title} · todos os participantes veem e podem editar.</DialogDescription>
        </DialogHeader>
        {!loaded ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
          <div className="cx-form max-h-[62vh] overflow-auto pr-1">
            <div><label className="cx-l" htmlFor="mm-agenda">Pauta</label><Textarea id="mm-agenda" rows={4} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder={'1. Resultados da semana\n2. Próximos passos'} /></div>
            <div><label className="cx-l" htmlFor="mm-minutes">Ata</label><Textarea id="mm-minutes" rows={6} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="O que foi conversado e decidido" /></div>
            <div>
              <label className="cx-l">Ações</label>
              <div className="flex flex-col gap-1.5">
                {actions.map((a) => (
                  <div key={a.id} className="grid grid-cols-[1fr_170px_140px_32px] items-center gap-1.5">
                    <Input value={a.text} onChange={(e) => setA(a.id, { text: e.target.value })} placeholder="O que precisa ser feito" aria-label="Ação" disabled={!!a.card_id} />
                    <Sel className="ui-sel" value={a.owner || ''} onChange={(e) => setA(a.id, { owner: e.target.value || null })} aria-label="Responsável" disabled={!!a.card_id}><option value="">Sem responsável</option>{people.map((u) => <option key={u.id} value={u.id}>{u.display_name || u.name}</option>)}</Sel>
                    <Input type="date" value={a.due || ''} onChange={(e) => setA(a.id, { due: e.target.value || null })} aria-label="Prazo" disabled={!!a.card_id} />
                    {a.card_id ? <span className="text-center text-[11px] font-semibold text-primary" title="Virou card">#{a.card_number ?? ''}</span>
                      : <button type="button" className="cx-iconbtn" onClick={() => setActions((l) => l.filter((x) => x.id !== a.id))} aria-label="Remover ação"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                ))}
              </div>
              <Button type="button" variant="ghost" size="sm" className="mt-1.5" onClick={() => setActions((l) => [...l, { id: rid(), text: '', owner: null, due: null, card_id: null }])}><Plus className="mr-1.5 h-4 w-4" />Adicionar ação</Button>
            </div>
            {pending.length && boards.length ? (
              <div className="rounded-[12px] border border-border p-3">
                <div className="mb-2 text-sm font-medium">Transformar {pending.length === 1 ? 'a ação' : `as ${pending.length} ações`} em cards</div>
                <div className="cx-two">
                  <Sel className="ui-sel" value={boardId} onChange={(e) => setBoardId(e.target.value)} aria-label="Mural">{boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Sel>
                  <Sel className="ui-sel" value={colId} onChange={(e) => setColId(e.target.value)} aria-label="Coluna">{cols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Sel>
                </div>
                <Button type="button" size="sm" className="mt-2" onClick={() => void toCards()} disabled={busy || !colId}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListPlus className="mr-2 h-4 w-4" />}Criar cards</Button>
              </div>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Fechar</Button>
          <Button onClick={async () => { setBusy(true); const ok = await save(); setBusy(false); if (ok) { toast.success('Pauta e ata salvas'); onOpenChange(false); } }} disabled={busy || !loaded}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MinutesButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return <Button type="button" variant="ghost" size="icon" className={className || 'h-6 w-6'} title="Pauta e ata" aria-label="Pauta e ata" onClick={(e) => { e.stopPropagation(); onClick(); }}><ClipboardList className="h-3 w-3" /></Button>;
}
