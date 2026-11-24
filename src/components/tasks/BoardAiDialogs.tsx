// EwvonAI inside a mural (company Claude key, daily limit):
//  - BoardSummaryDialog ("Acompanhar › Resumo com IA"): situação geral, atrasados, próximos prazos e sugestões.
//  - CardsFromTextDialog ("Organizar › Criar cards de um texto"): paste minutes, an e-mail or a list; the AI proposes
//    cards (title, description, priority, due date, responsible, column, checklist), the person reviews/edits and only
//    the checked ones are created — with the same insert path as the chat (chatTasks.createTask), so column rules and
//    automations still run.
import { useEffect, useMemo, useState } from 'react';
import { Copy, ListPlus, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sel } from '@/components/ui/Sel';
import * as CT from '@/lib/chatTasks';
import { aiCardsFromText, aiSummarizeBoard, renderAiText, type AiCard } from '@/lib/ewvonAi';
import '@/styles/chat-extras.css';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
type U = { id: string; name: string; display_name?: string | null };

/** Header of the EwvonAI dialogs: the full ewvon logo, a divider and the title (no DialogHeader mark). */
function AiHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-2 pr-8">
      <DialogTitle className="text-base font-semibold leading-tight">{title}</DialogTitle>
      <DialogDescription>{desc}</DialogDescription>
    </div>
  );
}

export function BoardSummaryDialog({ open, onOpenChange, boardId, boardName }: { open: boolean; onOpenChange: (o: boolean) => void; boardId: string; boardName: string }) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setText(null); setErr(''); } }, [open]);
  const run = async () => {
    setBusy(true); setErr('');
    try { setText((await aiSummarizeBoard(boardId)).text); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-xl">
        <AiHead title="Resumo do mural com IA" desc={`${boardName} · situação geral, cards em atenção, próximos prazos e sugestões.`} />
        {busy ? <div className="cx-sum flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Analisando os cards…</div>
          : err ? <div className="cx-sum text-muted-foreground">{err}</div>
          : text ? <div className="cx-sum">{renderAiText(text)}</div>
          : <p className="text-sm text-muted-foreground">O EwvonAI lê os cards deste mural (colunas, prazos, prioridades e responsáveis) e escreve um resumo. Cada resumo conta no limite diário de IA da empresa.</p>}
        <DialogFooter>
          {text ? <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(text).then(() => toast.success('Resumo copiado'), () => toast.error('Não foi possível copiar'))}><Copy className="mr-2 h-4 w-4" />Copiar</Button> : null}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Fechar</Button>
          <Button className="ai-btn" onClick={() => void run()} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{text ? 'Gerar de novo' : 'Gerar resumo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Draft = AiCard & { on: boolean; columnId: string; assigneeId: string };

export function CardsFromTextDialog({ open, onOpenChange, boardId, users, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; boardId: string; users: U[]; onCreated: () => void }) {
  const { profile } = useAuth();
  const [text, setText] = useState('');
  const [cols, setCols] = useState<CT.ChatColumn[]>([]);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  useEffect(() => {
    if (!open) return;
    setText(''); setDrafts(null); setProgress('');
    void CT.listColumns(boardId).then(setCols).catch(() => setCols([]));
  }, [open, boardId]);
  const firstCol = useMemo(() => cols.find((c) => !c.is_conclusion) || cols[0], [cols]);
  const matchUser = (name: string | null) => {
    if (!name) return '';
    const n = norm(name);
    return (users.find((u) => norm(u.display_name || u.name) === n) || users.find((u) => norm(u.display_name || u.name).startsWith(n) || n.startsWith(norm(u.display_name || u.name))))?.id || '';
  };
  const matchCol = (name: string | null) => (name ? cols.find((c) => norm(c.title) === norm(name))?.id : undefined) || firstCol?.id || '';

  const generate = async () => {
    setBusy(true);
    try {
      const { cards } = await aiCardsFromText(boardId, text);
      if (!cards.length) { toast.info('A IA não encontrou ações nesse texto.'); return; }
      setDrafts(cards.map((c) => ({ ...c, on: true, columnId: matchCol(c.column), assigneeId: matchUser(c.assignee) })));
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const set = (i: number, p: Partial<Draft>) => setDrafts((d) => (d ? d.map((x, j) => (j === i ? { ...x, ...p } : x)) : d));
  const chosen = drafts?.filter((d) => d.on && d.title.trim() && d.columnId) || [];
  const create = async () => {
    if (!profile?.id || !chosen.length) return;
    setBusy(true); let ok = 0;
    for (const d of chosen) {
      const column = cols.find((c) => c.id === d.columnId); if (!column) continue;
      setProgress(`Criando ${ok + 1} de ${chosen.length}…`);
      try {
        const t = await CT.createTask({ boardId, column, title: d.title, description: d.description, priority: d.priority, dueDate: d.due_date ? `${d.due_date}T21:00:00Z` : null, assignedTo: d.assigneeId || null, meProfileId: profile.id });
        if (d.subtasks.length) await (supabase as any).from('task_subtasks').insert(d.subtasks.map((s, i) => ({ task_id: t.id, title: s, position: i })));
        ok += 1;
      } catch { /* keep going; reported below */ }
    }
    setBusy(false); setProgress('');
    if (ok) { toast.success(ok === 1 ? '1 card criado' : `${ok} cards criados`); onCreated(); onOpenChange(false); }
    if (ok < chosen.length) toast.error(`${chosen.length - ok} card(s) não puderam ser criados.`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-xl">
        <AiHead title="Criar cards a partir de um texto" desc="Cole uma ata, um e-mail ou uma lista. O EwvonAI sugere os cards e você revisa antes de criar." />
        {!drafts ? (
          <div className="cx-form">
            <div className="ai-field ai-glow"><Textarea rows={10} className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" value={text} maxLength={30000} onChange={(e) => setText(e.target.value)} placeholder={'Ex.: Reunião de 21/11 — Ana revisa o contrato até sexta; Bruno agenda a visita ao cliente; precisamos atualizar a planilha de custos (urgente).'} aria-label="Texto" /></div>
            <p className="cx-hint">Responsáveis só são preenchidos quando o texto diz quem fará e o nome existe na empresa. Prazos relativos (“até sexta”) usam a data de hoje.</p>
          </div>
        ) : (
          <div className="flex max-h-[56vh] flex-col gap-2 overflow-auto pr-1">
            {drafts.map((d, i) => (
              <div key={i} className="rounded-[12px] border border-border bg-card p-3" style={{ opacity: d.on ? 1 : 0.55 }}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" className="mt-2.5" checked={d.on} onChange={(e) => set(i, { on: e.target.checked })} aria-label={`Criar o card ${d.title}`} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input value={d.title} maxLength={200} onChange={(e) => set(i, { title: e.target.value })} aria-label="Título" />
                    {d.description ? <Textarea rows={2} value={d.description} onChange={(e) => set(i, { description: e.target.value })} aria-label="Descrição" /> : null}
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <Sel className="ui-sel" value={d.columnId} onChange={(e) => set(i, { columnId: e.target.value })} aria-label="Coluna">{cols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Sel>
                      <Sel className="ui-sel" value={d.priority} onChange={(e) => set(i, { priority: e.target.value as Draft['priority'] })} aria-label="Prioridade"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="urgent">Urgente</option></Sel>
                      <Input type="date" value={d.due_date || ''} onChange={(e) => set(i, { due_date: e.target.value || null })} aria-label="Prazo" />
                      <Sel className="ui-sel" value={d.assigneeId} onChange={(e) => set(i, { assigneeId: e.target.value })} aria-label="Responsável"><option value="">Sem responsável</option>{users.map((u) => <option key={u.id} value={u.id}>{u.display_name || u.name}</option>)}</Sel>
                    </div>
                    {d.subtasks.length ? <p className="text-xs text-muted-foreground">Checklist: {d.subtasks.join(' · ')}</p> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          {progress ? <span className="mr-auto self-center text-xs text-muted-foreground">{progress}</span> : null}
          {drafts ? <Button variant="outline" onClick={() => setDrafts(null)} disabled={busy}>Voltar ao texto</Button> : <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>}
          {drafts
            ? <Button onClick={() => void create()} disabled={busy || !chosen.length}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListPlus className="mr-2 h-4 w-4" />}Criar {chosen.length} card{chosen.length === 1 ? '' : 's'}</Button>
            : <Button className="ai-btn" onClick={() => void generate()} disabled={busy || text.trim().length < 5}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}Sugerir cards</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
