// Desktop "Tarefas pelo chat": header button + dialog to create or move tasks in
// boards the user already accesses. The per-conversation switch lives here too
// (only conversation managers can change it), shared with the mobile app.
import { useEffect, useMemo, useState } from 'react';
import { ListTodo, Loader2, ArrowRight, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { getActiveCompanyId } from '@/lib/companyScope';
import * as CT from '@/lib/chatTasks';
import type { ChatBoard, ChatColumn, ChatTask } from '@/lib/chatTasks';
import { cn } from '@/lib/utils';

export function ChatTasksControl({ kind, chatId, onPost, className }: { kind: 'sector' | 'dm' | 'group'; chatId: string | null | undefined; onPost: (text: string) => Promise<unknown> | void; className?: string }) {
  const { profile } = useAuth();
  const key = chatId && profile?.id ? CT.chatSettingsKey(kind, chatId, profile.id) : null;
  const [enabled, setEnabled] = useState(false);
  const [manage, setManage] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    void Promise.all([CT.getTasksEnabled(key), CT.canManageChat(key)]).then(([e, m]) => { if (alive) { setEnabled(e); setManage(m); } }).catch(() => undefined);
    const unsub = CT.subscribeChatSettings(key, (v) => setEnabled(v));
    return () => { alive = false; unsub(); };
  }, [key]);

  if (!key || (!enabled && !manage)) return null;

  const toggle = async (v: boolean) => {
    setEnabled(v);
    try {
      await CT.setTasksEnabled(key, v, profile?.company_id || getActiveCompanyId() || '');
      toast.success(v ? 'Tarefas pelo chat ativadas' : 'Tarefas pelo chat desativadas');
    } catch {
      setEnabled(!v);
      toast.error('Não foi possível alterar a configuração');
    }
  };

  return (
    <>
      <Button type="button" variant="ghost" size="icon" title="Tarefas pelo chat" aria-label="Tarefas pelo chat" onClick={() => setOpen(true)}
        className={cn('h-9 w-9 shrink-0 rounded-full', enabled ? 'text-foreground' : 'text-muted-foreground', className)}>
        <ListTodo className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tarefas pelo chat</DialogTitle>
            <DialogDescription>Crie e mova tarefas dos quadros que você já acessa. A conversa recebe um card com o que foi feito.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Ativar nesta conversa</p>
              <p className="text-xs text-muted-foreground">{manage ? 'Vale para todos os participantes' : 'Só administradores da conversa podem mudar'}</p>
            </div>
            <Switch checked={enabled} disabled={!manage} onCheckedChange={(v) => void toggle(v)} />
          </div>
          {enabled ? <TasksPanel onPost={onPost} onDone={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TasksPanel({ onPost, onDone }: { onPost: (text: string) => Promise<unknown> | void; onDone: () => void }) {
  const { profile } = useAuth();
  const [mode, setMode] = useState('create');
  const [boards, setBoards] = useState<ChatBoard[] | null>(null);
  const [boardId, setBoardId] = useState('');
  const [cols, setCols] = useState<ChatColumn[]>([]);
  const [tasks, setTasks] = useState<ChatTask[]>([]);
  const [colId, setColId] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [prio, setPrio] = useState('medium');
  const [due, setDue] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<ChatTask | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { CT.listBoards().then((b) => { setBoards(b); if (b.length === 1) setBoardId(b[0].id); }).catch(() => setBoards([])); }, []);
  useEffect(() => {
    if (!boardId) return;
    setSel(null); setColId('');
    void Promise.all([CT.listColumns(boardId), CT.listTasks(boardId)]).then(([c, t]) => { setCols(c); setTasks(t); if (c[0]) setColId(c[0].id); }).catch(() => toast.error('Não foi possível abrir o quadro'));
  }, [boardId]);

  const board = boards?.find((b) => b.id === boardId);
  const colOf = (id: string) => cols.find((c) => c.id === id);
  const shown = useMemo(() => tasks.filter((t) => !q.trim() || `#${t.task_number} ${t.title}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 50), [tasks, q]);

  const create = async () => {
    const col = colOf(colId);
    if (!col || !board || !profile) return;
    setBusy(true);
    try {
      const t = await CT.createTask({ boardId, column: col, title, description: desc, priority: prio, dueDate: due ? new Date(due + 'T12:00:00').toISOString() : null, meProfileId: profile.id });
      await onPost(CT.cardMessage(t, board.name, `✅ Nova tarefa em ${col.title}`, desc.trim() || undefined));
      toast.success('Tarefa criada');
      onDone();
    } catch { toast.error('Não foi possível criar a tarefa'); } finally { setBusy(false); }
  };
  const move = async (target: ChatColumn) => {
    if (!sel || !board || target.id === sel.status) return;
    setBusy(true);
    try {
      const from = colOf(sel.status);
      await CT.moveTask(sel, boardId, target, from);
      await onPost(CT.cardMessage({ ...sel, status: target.id }, board.name, `➡️ Movida de ${from?.title || '—'} para ${target.title}`));
      toast.success(`Movida para ${target.title}`);
      onDone();
    } catch { toast.error('Não foi possível mover a tarefa'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <Tabs value={mode} onValueChange={setMode}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="create">Criar tarefa</TabsTrigger><TabsTrigger value="move">Mover tarefa</TabsTrigger></TabsList></Tabs>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Quadro</p>
        {boards === null ? <p className="text-sm text-muted-foreground">Carregando…</p> : !boards.length ? <p className="text-sm text-muted-foreground">Você ainda não participa de nenhum quadro.</p> : (
          <div className="flex flex-wrap gap-2">{boards.map((b) => <button key={b.id} type="button" onClick={() => setBoardId(b.id)} className={cn('rounded-full border px-3 py-1.5 text-sm', b.id === boardId ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-muted')}>{b.name}</button>)}</div>
        )}
      </div>
      {boardId && mode === 'create' ? (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Coluna</p>
            <div className="flex flex-wrap gap-2">{cols.map((c) => <button key={c.id} type="button" onClick={() => setColId(c.id)} className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm', c.id === colId ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-muted')}><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.title}</button>)}</div>
          </div>
          <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Título da tarefa" />
          <Textarea value={desc} maxLength={1000} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição (opcional)" rows={2} />
          <div className="grid grid-cols-2 gap-2">
            <select value={prio} onChange={(e) => setPrio(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {Object.entries(CT.PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>Prioridade {v}</option>)}
            </select>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <Button className="w-full" disabled={busy || title.trim().length < 2 || !colId} onClick={() => void create()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar e enviar no chat'}</Button>
        </div>
      ) : null}
      {boardId && mode === 'move' ? (
        <div className="space-y-2">
          {!sel ? (
            <>
              <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número ou título" /></div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {shown.map((t) => <button key={t.id} type="button" onClick={() => setSel(t)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"><span className="min-w-0 truncate">#{t.task_number} · {t.title}</span><span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: colOf(t.status)?.color }} />{colOf(t.status)?.title}</span></button>)}
                {!shown.length ? <p className="p-3 text-sm text-muted-foreground">Nenhuma tarefa encontrada</p> : null}
              </div>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setSel(null)} className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-muted">#{sel.task_number} · {sel.title}<span className="block text-xs text-muted-foreground">Atual: {colOf(sel.status)?.title} · clique para trocar</span></button>
              <p className="pt-1 text-xs font-medium text-muted-foreground">Mover para</p>
              <div className="grid grid-cols-2 gap-2">{cols.map((c) => <button key={c.id} type="button" disabled={busy || c.id === sel.status} onClick={() => void move(c)} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} /><span className="min-w-0 flex-1 truncate">{c.title}</span><ArrowRight className="h-3.5 w-3.5" /></button>)}</div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
