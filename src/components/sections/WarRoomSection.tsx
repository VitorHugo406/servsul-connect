import { PageHeader } from '@/components/common/PageHeader';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWarRooms, useWarRoomDetail, WarRoom, WarRoomAction, NewWarRoomAction } from '@/hooks/useWarRooms';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ListSkeleton } from '@/components/ui/skeletons';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Siren, Plus, Send, ChevronLeft, Trash2, ExternalLink, ArrowUp, ArrowDown, Pencil, Check, X, Lock, CheckCircle2, Circle, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { appConfirm } from '@/lib/appDialog';

/* ───────── helpers ───────── */

const fmtDur = (min: number) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
};
const nameOf = (p?: { name?: string; display_name?: string | null } | null) => p?.display_name || p?.name || '—';
const toLocalInput = (iso?: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '');

interface ProfileLite { id: string; name: string; display_name: string | null; avatar_url: string | null }
interface BoardLite { id: string; name: string }
interface ColumnLite { id: string; name: string; board_id: string }

function useProfiles() {
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  useEffect(() => {
    supabase.from('profiles').select('id, name, display_name, avatar_url').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setProfiles(data as ProfileLite[]); });
  }, []);
  return profiles;
}

function useBoardsAndColumns() {
  const [boards, setBoards] = useState<BoardLite[]>([]);
  const [columns, setColumns] = useState<ColumnLite[]>([]);
  useEffect(() => {
    supabase.from('task_boards').select('id, name').order('name').then(({ data }) => { if (data) setBoards(data as BoardLite[]); });
    supabase.from('task_board_columns').select('id, title, board_id, position').order('position')
      .then(({ data }) => { if (data) setColumns((data as any[]).map(c => ({ id: c.id, name: c.title, board_id: c.board_id }))); });
  }, []);
  return { boards, columns };
}

function BoardColumnPicker({ boards, columns, boardId, columnId, onChange, disabled }: {
  boards: BoardLite[]; columns: ColumnLite[]; boardId: string; columnId: string;
  onChange: (b: string, c: string) => void; disabled?: boolean;
}) {
  const cols = columns.filter(c => c.board_id === boardId);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="wr-label">Quadro</label>
        <Select value={boardId} disabled={disabled} onValueChange={v => onChange(v, '')}>
          <SelectTrigger><SelectValue placeholder="Selecione o quadro" /></SelectTrigger>
          <SelectContent>{boards.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <label className="wr-label">Coluna</label>
        <Select value={columnId} disabled={disabled || !boardId} onValueChange={v => onChange(boardId, v)}>
          <SelectTrigger><SelectValue placeholder="Selecione a coluna" /></SelectTrigger>
          <SelectContent>{cols.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
      active ? 'bg-[#FDECEC] text-[#C62828]' : 'bg-muted text-muted-foreground')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-[#C62828] animate-pulse' : 'bg-muted-foreground/60')} />
      {active ? 'Ativa' : 'Encerrada'}
    </span>
  );
}

/* ───────── nova war room ───────── */

function NewWarRoomForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (room: WarRoom) => void }) {
  const { createWarRoom } = useWarRooms();
  const profiles = useProfiles();
  const { boards, columns } = useBoardsAndColumns();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [actions, setActions] = useState<NewWarRoomAction[]>([]);
  const [draft, setDraft] = useState<NewWarRoomAction>({ title: '', assigned_to: null, duration_min: 15 });
  const [withCard, setWithCard] = useState(false);
  const [boardId, setBoardId] = useState('');
  const [columnId, setColumnId] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = profiles.filter(p => nameOf(p).toLowerCase().includes(search.toLowerCase()));
  const addDraft = () => {
    if (!draft.title.trim()) return;
    setActions(a => [...a, { ...draft, title: draft.title.trim() }]);
    setDraft({ title: '', assigned_to: null, duration_min: 15 });
  };
  const totalMin = actions.reduce((s, a) => s + a.duration_min, 0);

  const checklist = [
    { ok: !!title.trim(), label: 'Título informado' },
    { ok: members.length > 0, label: 'Ao menos um convocado' },
    { ok: actions.length > 0, label: 'Ao menos uma ação na timeline' },
    { ok: !withCard || (!!boardId && !!columnId), label: 'Quadro e coluna do card (se ativado)' },
  ];
  const ready = checklist.every(c => c.ok);

  const submit = async () => {
    if (!ready) return;
    setCreating(true);
    const room = await createWarRoom(title.trim(), description.trim(), members, {
      targetAt: target ? new Date(target).toISOString() : null,
      actions,
      board_id: withCard ? boardId : undefined,
      column_id: withCard ? columnId : undefined,
    });
    setCreating(false);
    if (room) onCreated(room);
  };

  return (
    <div className="wr-pg p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel}><ChevronLeft className="h-5 w-5" /></Button>
        <div>
          <h2 className="text-xl font-bold">Nova War Room</h2>
          <p className="text-sm text-muted-foreground">Defina o incidente, o plano de ação e quem será convocado.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className="wr-card space-y-4">
            <h3 className="wr-h">Incidente</h3>
            <div>
              <label className="wr-label">Título *</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Queda do sistema de produção" />
            </div>
            <div>
              <label className="wr-label">Descrição</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Descreva o ocorrido..." />
            </div>
            <div className="sm:max-w-xs">
              <label className="wr-label">Meta de resolução</label>
              <Input type="datetime-local" value={target} onChange={e => setTarget(e.target.value)} />
            </div>
          </section>

          <section className="wr-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="wr-h">Timeline de ações *</h3>
              {actions.length > 0 && <span className="text-xs text-muted-foreground">{actions.length} ações · {fmtDur(totalMin)}</span>}
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_180px_110px_auto]">
              <Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Ex: Isolar o serviço e validar logs"
                onKeyDown={e => e.key === 'Enter' && addDraft()} />
              <Select value={draft.assigned_to || 'none'} onValueChange={v => setDraft({ ...draft, assigned_to: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{nameOf(p)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" min={1} value={draft.duration_min}
                onChange={e => setDraft({ ...draft, duration_min: Math.max(1, Number(e.target.value) || 1) })} aria-label="Duração em minutos" />
              <Button type="button" onClick={addDraft} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
            </div>
            {actions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma ação ainda. A duração é em minutos.</p>
            ) : (
              <ol className="space-y-1.5">
                {actions.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 min-w-0 truncate text-sm">{a.title}</span>
                    <span className="hidden sm:block text-xs text-muted-foreground">{nameOf(profiles.find(p => p.id === a.assigned_to)) !== '—' ? nameOf(profiles.find(p => p.id === a.assigned_to)) : 'Sem responsável'}</span>
                    <span className="text-xs text-muted-foreground w-14 text-right">{fmtDur(a.duration_min)}</span>
                    <Button type="button" variant="ghost" size="icon" disabled={i === 0}
                      onClick={() => setActions(l => { const n = [...l]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" disabled={i === actions.length - 1}
                      onClick={() => setActions(l => { const n = [...l]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}><ArrowDown className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setActions(l => l.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="wr-card space-y-3">
            <h3 className="wr-h">Convocados *</h3>
            <Input placeholder="Buscar pessoa..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="max-h-56 overflow-auto rounded-md border p-1">
              {filtered.map(p => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted">
                  <Checkbox checked={members.includes(p.id)}
                    onCheckedChange={c => setMembers(prev => c ? [...prev, p.id] : prev.filter(x => x !== p.id))} />
                  <Avatar className="h-7 w-7"><AvatarImage src={p.avatar_url || ''} /><AvatarFallback className="text-[10px]">{nameOf(p)[0]}</AvatarFallback></Avatar>
                  <span className="text-sm">{nameOf(p)}</span>
                </label>
              ))}
            </div>
            {members.length > 0 && <p className="text-xs text-muted-foreground">{members.length} selecionado(s)</p>}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="wr-card space-y-3">
            <h3 className="wr-h">Card no mural</h3>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={withCard} onCheckedChange={c => setWithCard(!!c)} className="mt-0.5" />
              <span>Criar card emergencial junto com a sala</span>
            </label>
            {withCard && (
              <>
                <BoardColumnPicker boards={boards} columns={columns} boardId={boardId} columnId={columnId}
                  onChange={(b, c) => { setBoardId(b); setColumnId(c); }} />
                <p className="text-xs text-muted-foreground">
                  Só quadro e coluna. Título, descrição e prazo vêm da sala, e as subtarefas são a timeline. O card fica bloqueado
                  enquanto a sala estiver ativa e vai para Concluída quando ela for encerrada.
                </p>
              </>
            )}
          </section>

          <section className="wr-card space-y-2">
            <h3 className="wr-h">Antes de lançar</h3>
            {checklist.map(c => (
              <div key={c.label} className={cn('flex items-center gap-2 text-sm', c.ok ? 'text-foreground' : 'text-muted-foreground')}>
                {c.ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4" />} {c.label}
              </div>
            ))}
            <Button onClick={submit} disabled={!ready || creating} className="mt-2 w-full gap-2 bg-[#C62828] text-white hover:bg-[#B71C1C]">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Siren className="h-4 w-4" />}
              {creating ? 'Lançando...' : 'Lançar alerta e ativar'}
            </Button>
            <Button variant="outline" onClick={onCancel} className="w-full">Cancelar</Button>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ───────── ação (linha) ───────── */

function ActionRow({ a, index, firstPendingId, profiles, canManage, canToggle, active, onToggle, onSave, onDelete, onMove, last }: {
  a: WarRoomAction; index: number; firstPendingId?: string; profiles: ProfileLite[]; canManage: boolean; canToggle: boolean; active: boolean;
  onToggle: (done: boolean) => void; onSave: (p: { title: string; assigned_to: string | null; duration_min: number }) => void;
  onDelete: () => void; onMove: (d: -1 | 1) => void; last: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(a.title);
  const [who, setWho] = useState(a.assigned_to);
  const [dur, setDur] = useState(a.duration_min);
  const owner = profiles.find(p => p.id === a.assigned_to);
  const done = a.status === 'done';
  const current = !done && a.id === firstPendingId;

  if (editing) {
    return (
      <li className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_170px_100px_auto]">
        <Input value={t} onChange={e => setT(e.target.value)} />
        <Select value={who || 'none'} onValueChange={v => setWho(v === 'none' ? null : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem responsável</SelectItem>
            {profiles.map(p => <SelectItem key={p.id} value={p.id}>{nameOf(p)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="number" min={1} value={dur} onChange={e => setDur(Math.max(1, Number(e.target.value) || 1))} />
        <div className="flex gap-1">
          <Button size="icon" onClick={() => { if (t.trim()) { onSave({ title: t.trim(), assigned_to: who, duration_min: dur }); setEditing(false); } }}><Check className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" onClick={() => { setEditing(false); setT(a.title); setWho(a.assigned_to); setDur(a.duration_min); }}><X className="h-4 w-4" /></Button>
        </div>
      </li>
    );
  }

  return (
    <li className={cn('flex items-center gap-3 rounded-md border px-3 py-2.5', current && 'border-[#C62828]/50 bg-[#FDECEC]/40', done && 'bg-muted/40')}>
      <Checkbox checked={done} disabled={!active || !canToggle} onCheckedChange={c => onToggle(!!c)} aria-label="Concluir ação" />
      <span className="w-5 text-xs text-muted-foreground">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', done && 'text-muted-foreground line-through')}>{a.title}</p>
        <p className="text-xs text-muted-foreground">
          {owner ? nameOf(owner) : 'Sem responsável'} · {fmtDur(a.duration_min)}
          {done && a.completed_at && ` · concluída ${format(new Date(a.completed_at), 'dd/MM HH:mm')}`}
        </p>
      </div>
      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold',
        done ? 'bg-green-100 text-green-700' : current ? 'bg-[#FDECEC] text-[#C62828]' : 'bg-muted text-muted-foreground')}>
        {done ? 'Concluída' : current ? 'Em andamento' : 'Pendente'}
      </span>
      {active && canManage && (
        <div className="flex">
          <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" disabled={last} onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      )}
    </li>
  );
}

/* ───────── detalhe ───────── */

function WarRoomDetail({ room: initial, onBack }: { room: WarRoom; onBack: () => void }) {
  const [room, setRoom] = useState(initial);
  const { members, timeline, messages, actions, loading, acknowledge, sendMessage, addAction, updateAction, deleteAction, moveAction, setActionDone, isRoomCreator } =
    useWarRoomDetail(room.id, room.created_by);
  const { user, profile } = useAuth();
  const { closeWarRoom, createEmergencyCard } = useWarRooms();
  const profiles = useProfiles();
  const { boards, columns } = useBoardsAndColumns();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<'log' | 'chat'>('log');
  const [msg, setMsg] = useState('');
  const [draft, setDraft] = useState<NewWarRoomAction>({ title: '', assigned_to: null, duration_min: 15 });
  const [boardId, setBoardId] = useState('');
  const [columnId, setColumnId] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const isActive = room.status === 'active';
  const canManage = isActive && (isRoomCreator || profile?.autonomy_level === 'admin');

  // keep room status/task in sync (close, card creation)
  useEffect(() => {
    const ch = supabase.channel(`wr-room-${room.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'war_rooms', filter: `id=eq.${room.id}` },
        p => setRoom(r => ({ ...r, ...(p.new as any) })))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [room.id]);

  const me = members.find(m => m.user_id === user?.id);
  const needsAck = me && !me.has_acknowledged;
  useEffect(() => { if (needsAck) acknowledge(); }, [needsAck, acknowledge]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, tab]);

  const sorted = useMemo(() => [...actions].sort((a, b) => a.position - b.position), [actions]);
  const firstPending = sorted.find(a => a.status === 'pending');
  const doneCount = sorted.filter(a => a.status === 'done').length;
  const remainingMin = sorted.filter(a => a.status === 'pending').reduce((s, a) => s + a.duration_min, 0);
  const forecast = isActive ? addMinutes(new Date(), remainingMin) : room.closed_at ? new Date(room.closed_at) : new Date();
  const target = room.target_at ? new Date(room.target_at) : null;
  const onTime = !target || forecast <= target;
  const pct = sorted.length ? Math.round((doneCount / sorted.length) * 100) : 0;

  const openCard = useCallback(() => {
    if (!room.task_id || !room.emergency_board_id) return;
    const next = new URLSearchParams(searchParams);
    next.set('section', 'tasks'); next.set('board', room.emergency_board_id); next.set('task', room.task_id);
    setSearchParams(next);
  }, [room, searchParams, setSearchParams]);

  const openCardAny = async () => {
    if (!room.task_id) return;
    const { data } = await supabase.from('tasks').select('board_id').eq('id', room.task_id).maybeSingle();
    const b = (data as any)?.board_id;
    if (!b) return;
    const next = new URLSearchParams(searchParams);
    next.set('section', 'tasks'); next.set('board', b); next.set('task', room.task_id);
    setSearchParams(next);
  };

  const makeCard = async () => {
    setBusy(true);
    const r = await createEmergencyCard(room.id, boardId, columnId);
    setBusy(false);
    if (r) setRoom(x => ({ ...x, task_id: r.o_task_id, emergency_board_id: boardId, emergency_column_id: columnId }));
  };

  const send = async () => {
    if (!msg.trim()) return;
    const m = msg; setMsg('');
    if (!(await sendMessage(m))) setMsg(m);
  };

  const add = async () => {
    if (!draft.title.trim()) return;
    if (await addAction(draft)) setDraft({ title: '', assigned_to: null, duration_min: 15 });
  };

  const close = async () => {
    if (!(await appConfirm({
      title: 'Encerrar esta War Room?',
      message: room.task_id ? 'O card emergencial será movido para a coluna Concluída e a sala ficará somente leitura.' : 'A sala ficará somente leitura.',
      confirmText: 'Encerrar', danger: true,
    }))) return;
    await closeWarRoom(room.id);
    setRoom(r => ({ ...r, status: 'closed', closed_at: new Date().toISOString() }));
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col space-y-4 p-4">
        <div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-lg" /><Skeleton className="h-5 w-1/3 rounded-md" /></div>
        <ListSkeleton rows={4} showAvatar={false} />
      </div>
    );
  }

  return (
    <div className="wr-pg space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ChevronLeft className="h-5 w-5" /></Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-bold">{room.title}</h2>
            <StatusPill active={isActive} />
          </div>
          {room.description && <p className="mt-1 text-sm text-muted-foreground">{room.description}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            Aberta em {format(new Date(room.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            {room.closed_at && ` · encerrada em ${format(new Date(room.closed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
          </p>
        </div>
        {canManage && (
          <Button variant="outline" onClick={close} className="gap-1 border-[#C62828] text-[#C62828] hover:bg-[#FDECEC]">
            <X className="h-4 w-4" /> Encerrar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="wr-stat"><span>Progresso</span><b>{doneCount}/{sorted.length}</b><i style={{ width: `${pct}%` }} /></div>
        <div className="wr-stat"><span>Restante</span><b>{fmtDur(remainingMin)}</b></div>
        <div className="wr-stat"><span>{isActive ? 'Previsão' : 'Encerrada'}</span><b>{format(forecast, 'dd/MM HH:mm')}</b></div>
        <div className={cn('wr-stat', target && (onTime ? 'ok' : 'late'))}>
          <span>Meta</span><b>{target ? format(target, 'dd/MM HH:mm') : 'Sem meta'}</b>
          {target && <em>{onTime ? 'Dentro da meta' : 'Acima da meta'}</em>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="wr-card space-y-3">
            <h3 className="wr-h">Timeline de ações</h3>
            {sorted.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma ação cadastrada.</p>}
            <ol className="space-y-1.5">
              {sorted.map((a, i) => (
                <ActionRow key={a.id} a={a} index={i} last={i === sorted.length - 1} firstPendingId={firstPending?.id}
                  profiles={profiles} canManage={canManage} active={isActive}
                  canToggle={Boolean(me) || canManage}
                  onToggle={d => setActionDone(a.id, d)}
                  onSave={p => updateAction(a.id, p)}
                  onDelete={async () => { if (await appConfirm({ title: 'Remover esta ação?', message: a.title, confirmText: 'Remover', danger: true })) deleteAction(a.id); }}
                  onMove={d => moveAction(a.id, d)} />
              ))}
            </ol>
            {canManage && (
              <div className="grid gap-2 pt-1 sm:grid-cols-[1fr_170px_100px_auto]">
                <Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Nova ação..."
                  onKeyDown={e => e.key === 'Enter' && add()} />
                <Select value={draft.assigned_to || 'none'} onValueChange={v => setDraft({ ...draft, assigned_to: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id}>{nameOf(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" min={1} value={draft.duration_min} onChange={e => setDraft({ ...draft, duration_min: Math.max(1, Number(e.target.value) || 1) })} />
                <Button onClick={add} disabled={!draft.title.trim()} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
              </div>
            )}
          </section>

          <section className="wr-card">
            <div className="mb-3 flex gap-1 border-b">
              {(['log', 'chat'] as const).map(k => (
                <button key={k} onClick={() => setTab(k)}
                  className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === k ? 'border-[#171A21] text-foreground' : 'border-transparent text-muted-foreground')}>
                  {k === 'log' ? 'Registro de alterações' : 'Chat'}
                </button>
              ))}
            </div>
            {tab === 'log' ? (
              <ul className="max-h-80 space-y-3 overflow-auto pr-1">
                {timeline.length === 0 && <li className="text-sm text-muted-foreground">Sem registros.</li>}
                {[...timeline].reverse().map(e => (
                  <li key={e.id} className="text-sm">
                    <p>{e.content}</p>
                    <p className="text-xs text-muted-foreground">{e.creator_name} · {format(new Date(e.created_at), 'dd/MM HH:mm', { locale: ptBR })}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div>
                <div className="max-h-80 space-y-3 overflow-auto pr-1">
                  {messages.map(m => {
                    const own = m.sender_id === profile?.id;
                    return (
                      <div key={m.id} className={cn('flex gap-2', own && 'flex-row-reverse')}>
                        <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={m.sender?.avatar_url || ''} /><AvatarFallback className="text-[9px]">{nameOf(m.sender)[0]}</AvatarFallback></Avatar>
                        <div className={cn('max-w-[75%] rounded-xl px-3 py-2', own ? 'bg-[#171A21] text-white' : 'bg-muted')}>
                          {!own && <p className="mb-0.5 text-[10px] font-semibold">{nameOf(m.sender)}</p>}
                          <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                          <p className={cn('mt-0.5 text-[10px]', own ? 'text-white/70' : 'text-muted-foreground')}>{format(new Date(m.created_at), 'HH:mm')}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                {isActive && (
                  <div className="mt-3 flex gap-2">
                    <Input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Mensagem..." onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()} />
                    <Button size="icon" onClick={send} disabled={!msg.trim()}><Send className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="wr-card space-y-3">
            <h3 className="wr-h">Card no mural</h3>
            {room.task_id ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {isActive
                    ? 'Card vinculado. Ele não pode ser alterado enquanto a sala estiver ativa: só as subtarefas (a timeline) podem ser concluídas, e isso se reflete aqui.'
                    : 'Card concluído junto com a sala.'}
                </p>
                {isActive && <p className="flex items-center gap-1.5 text-xs text-[#C62828]"><Lock className="h-3.5 w-3.5" /> Bloqueado pela War Room</p>}
                <Button variant="outline" className="w-full gap-2" onClick={room.emergency_board_id ? openCard : openCardAny}>
                  <ExternalLink className="h-4 w-4" /> Abrir no mural
                </Button>
              </>
            ) : canManage ? (
              <>
                <p className="text-sm text-muted-foreground">Informe só o quadro e a coluna. O resto vem desta sala.</p>
                <BoardColumnPicker boards={boards} columns={columns} boardId={boardId} columnId={columnId} onChange={(b, c) => { setBoardId(b); setColumnId(c); }} />
                <Button className="w-full" disabled={!boardId || !columnId || busy} onClick={makeCard}>
                  {busy ? 'Criando...' : 'Criar card'}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Esta sala não tem card.</p>
            )}
          </section>

          <section className="wr-card space-y-2">
            <h3 className="wr-h">Convocados</h3>
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                <Avatar className="h-7 w-7"><AvatarImage src={m.profile?.avatar_url || ''} /><AvatarFallback className="text-[10px]">{nameOf(m.profile)[0]}</AvatarFallback></Avatar>
                <span className="flex-1 truncate text-sm">{nameOf(m.profile)}</span>
                <span className={cn('text-xs font-medium', m.has_acknowledged ? 'text-green-600' : 'text-[#C62828]')}>
                  {m.has_acknowledged ? 'Confirmou' : 'Aguardando'}
                </span>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ───────── lista ───────── */

export function WarRoomSection() {
  const { warRooms, loading, canCreateWarRoom, deleteWarRoom, fetchWarRooms } = useWarRooms();
  const [selected, setSelected] = useState<WarRoom | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('active');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const list = warRooms.filter(r => filter === 'all' || r.status === filter);
  const activeCount = warRooms.filter(r => r.status === 'active').length;

  const remove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!(await appConfirm({ title: 'Excluir esta War Room?', message: 'Esta ação não pode ser desfeita.', confirmText: 'Excluir', danger: true }))) return;
    setDeletingId(id);
    await deleteWarRoom(id);
    setDeletingId(null);
  };

  if (creating) return <NewWarRoomForm onCancel={() => setCreating(false)} onCreated={r => { setCreating(false); setSelected(r); }} />;
  if (selected) return <WarRoomDetail room={selected} onBack={() => { setSelected(null); fetchWarRooms(); }} />;

  return (
    <div className="wr-pg space-y-5 p-4 md:p-6">
      <PageHeader eyebrow="Operação" icon={<Siren />} title="War Room" subtitle="Gestão de incidentes críticos e respostas de emergência"
        actions={canCreateWarRoom && (
          <Button onClick={() => setCreating(true)} className="gap-2 bg-[#C62828] text-white hover:bg-[#B71C1C]"><Plus className="h-4 w-4" /> Nova War Room</Button>
        )} />

      <div className="flex flex-wrap gap-2">
        {([['active', `Ativas${activeCount ? ` (${activeCount})` : ''}`], ['closed', 'Histórico'], ['all', 'Todas']] as const).map(([k, label]) => (
          <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}
            className={cn('ui-chip rounded-md border px-3 py-1.5 text-sm font-medium',
              filter === k ? 'border-[#171A21] bg-[#171A21] text-white' : 'bg-card text-muted-foreground hover:bg-muted')}>{label}</button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton rows={4} showAvatar={false} />
      ) : list.length === 0 ? (
        <div className="wr-card py-16 text-center">
          <Siren className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">Nenhuma War Room {filter === 'active' ? 'ativa' : filter === 'closed' ? 'no histórico' : ''}</p>
          <p className="mt-1 text-sm text-muted-foreground/70">{canCreateWarRoom ? 'Crie uma sala quando houver um incidente crítico.' : 'As salas aparecerão aqui.'}</p>
        </div>
      ) : (
        <div className="wr-card divide-y p-0">
          {list.map(r => (
            <div key={r.id} onClick={() => setSelected(r)} className="flex cursor-pointer items-center gap-4 px-4 py-3.5 hover:bg-muted/50">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', r.status === 'active' ? 'bg-[#FDECEC] text-[#C62828]' : 'bg-muted text-muted-foreground')}>
                <Siren className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  {r.target_at && ` · meta ${format(new Date(r.target_at), 'dd/MM HH:mm')}`}
                  {r.task_id && ' · com card'}
                </p>
              </div>
              <StatusPill active={r.status === 'active'} />
              {r.status === 'closed' && canCreateWarRoom && (
                <Button variant="ghost" size="icon" disabled={deletingId === r.id} onClick={e => remove(e, r.id)}>
                  {deletingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
