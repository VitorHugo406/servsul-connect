import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWarRooms, useWarRoomDetail, WarRoom, WarRoomAction, WarRoomMember, NewWarRoomAction } from '@/hooks/useWarRooms';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, addMinutes, differenceInMinutes, isSameDay } from 'date-fns';
import { appConfirm } from '@/lib/appDialog';
import { Sel } from '@/components/ui/Sel';

/* Telas fiéis ao design "Tela_de_Avisos_2.html" (estilos em src/styles/warroom.css; prefixos wd- sala, wl- lista, wn- nova). */

/* ───────── utilitários ───────── */

const pre = (p: string) => (s: string) => s.split(/\s+/).filter(Boolean).map(c => p + c).join(' ');
const d = pre('wd-');
const l = pre('wl-');
const n = pre('wn-');

const ICON: Record<string, { p: string; fill?: boolean; sw?: number }> = {
  back: { p: 'M15 5l-7 7 7 7', sw: 2.2 },
  siren: { p: 'M7 18v-6a5 5 0 0 1 10 0v6M5 18h14v3H5zM12 2v2M4.5 5.5L6 7M19.5 5.5L18 7' },
  trash: { p: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12' },
  card: { p: 'M6 3h9l4 4v14H6zM9 12h6M12 9v6' },
  xcircle: { p: 'M9 9l6 6M15 9l-6 6' },
  send: { p: 'M21 3L10 14M21 3l-7 18-4-7-7-4z' },
  check: { p: 'M5 12l5 5 9-10', sw: 3.2 },
  edit: { p: 'M4 20h4L19 9l-4-4L4 16v4z' },
  x: { p: 'M6 6l12 12M18 6L6 18' },
  warn: { p: 'M12 3l10 18H2zM12 10v5' },
};
function Ico({ name, size = 16 }: { name: string; size?: number }) {
  const i = ICON[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={i.sw || 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={i.p} />
      {name === 'xcircle' && <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}
const Grip = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
  </svg>
);

const fmtDur = (min: number) => {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`;
};
const hhmm = (dt: Date) => format(dt, 'HH:mm');
const dayTime = (dt: Date) => (isSameDay(dt, new Date()) ? `Hoje, ${hhmm(dt)}` : format(dt, 'dd/MM, HH:mm'));
const nameOf = (p?: { name?: string; display_name?: string | null } | null) => p?.display_name || p?.name || '—';
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.trim().slice(0, 1).toUpperCase();
};

interface ProfileLite { id: string; user_id: string; name: string; display_name: string | null; avatar_url: string | null; autonomy_level: string | null }
interface BoardLite { id: string; name: string }
interface ColumnLite { id: string; name: string; board_id: string }

function useProfiles() {
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  useEffect(() => {
    supabase.from('profiles').select('id, user_id, name, display_name, avatar_url, autonomy_level').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setProfiles(data as unknown as ProfileLite[]); });
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

function Av({ p, person, size }: { p: (s: string) => string; person?: { name?: string; display_name?: string | null; avatar_url?: string | null; autonomy_level?: string | null } | null; size?: number }) {
  const nm = nameOf(person);
  const admin = person?.autonomy_level === 'admin';
  const style = size ? { width: size, height: size } : undefined;
  if (person?.avatar_url) {
    return <span className={p('mav')} style={{ ...style, overflow: 'hidden', padding: 0 }}><img src={person.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></span>;
  }
  return <span className={p(admin ? 'mav sa' : 'mav')} style={style}>{initials(nm)}</span>;
}

/** Cálculo de horários da timeline: concluídas usam o horário real; as pendentes encadeiam a partir da última conclusão. */
function buildSchedule(room: Pick<WarRoom, 'created_at' | 'closed_at'>, sorted: WarRoomAction[], now: Date) {
  const rows = new Map<string, { start: Date; end: Date }>();
  const done = sorted.filter(a => a.status === 'done' && a.completed_at);
  let cursor = done.length ? new Date(Math.max(...done.map(a => new Date(a.completed_at as string).getTime()))) : new Date(room.created_at);
  let first = true;
  for (const a of sorted) {
    if (a.status === 'done' && a.completed_at) {
      rows.set(a.id, { start: new Date(a.started_at || room.created_at), end: new Date(a.completed_at) });
    }
  }
  for (const a of sorted) {
    if (a.status === 'pending') {
      const start = cursor;
      let end = addMinutes(start, a.duration_min);
      if (first && end < now) end = now;
      first = false;
      rows.set(a.id, { start, end });
      cursor = end;
    }
  }
  const forecast = sorted.some(a => a.status === 'pending') ? cursor : (done.length ? cursor : new Date(room.closed_at || now));
  return { rows, forecast };
}

/** Texto e tom do comparativo com a meta. */
function metaStatus(target: Date | null, forecast: Date, closed: boolean) {
  if (!target) return null;
  const diff = differenceInMinutes(target, forecast);
  if (closed) return diff >= 0 ? { cls: 'done', text: 'Dentro da meta' } : { cls: 'bad', text: `Fora da meta (+${Math.abs(diff)} min)` };
  return diff >= 0
    ? { cls: 'ok', text: `${diff} min antes da meta (${hhmm(target)})` }
    : { cls: 'late', text: `Atraso previsto de ${Math.abs(diff)} min (meta ${hhmm(target)})` };
}

/* ───────── modal: quadro + coluna do card ───────── */

function CardPickerModal({ initialBoard, initialColumn, confirmText, onClose, onConfirm }: {
  initialBoard?: string; initialColumn?: string; confirmText: string; onClose: () => void; onConfirm: (board: string, column: string) => void | Promise<void>;
}) {
  const { boards, columns } = useBoardsAndColumns();
  const [board, setBoard] = useState(initialBoard || '');
  const [column, setColumn] = useState(initialColumn || '');
  const [busy, setBusy] = useState(false);
  const cols = columns.filter(c => c.board_id === board);
  return (
    <div className="wx-ov" onClick={onClose}>
      <div className="wx-md" role="dialog" aria-label="Card emergencial" onClick={e => e.stopPropagation()}>
        <h3>Card emergencial</h3>
        <div className="wx-bd">
          <label>Quadro
            <Sel value={board} onChange={e => { setBoard(e.target.value); setColumn(''); }}>
              <option value="">Selecione o quadro</option>
              {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Sel>
          </label>
          <label>Coluna
            <Sel value={column} disabled={!board} onChange={e => setColumn(e.target.value)}>
              <option value="">Selecione a coluna</option>
              {cols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Sel>
          </label>
          <p>Só o quadro e a coluna. Título, descrição e data de entrega vêm da sala, e as subtarefas são a timeline. O card não pode ser alterado enquanto a sala estiver ativa e vai para Concluída quando ela for encerrada.</p>
        </div>
        <div className="wx-ft">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="button" className="wx-pri" disabled={!board || !column || busy}
            onClick={async () => { setBusy(true); await onConfirm(board, column); setBusy(false); }}>{confirmText}</button>
        </div>
      </div>
    </div>
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
  const [draftMin, setDraftMin] = useState('');
  const [card, setCard] = useState<{ board: string; column: string } | null>(null);
  const [cardModal, setCardModal] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<NewWarRoomAction>({ title: '', assigned_to: null, duration_min: 15 });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const now = useMemo(() => new Date(), []);

  const filtered = profiles.filter(p => nameOf(p).toLowerCase().includes(search.toLowerCase()));
  const person = (id: string | null) => profiles.find(p => p.id === id) || null;

  const add = () => {
    if (!draft.title.trim()) return;
    const dur = Math.max(1, parseInt(draftMin, 10) || 15);
    setActions(a => [...a, { ...draft, title: draft.title.trim(), duration_min: dur }]);
    setDraft({ title: '', assigned_to: null, duration_min: 15 }); setDraftMin('');
  };

  const totalMin = actions.reduce((s, a) => s + a.duration_min, 0);
  const forecast = addMinutes(now, totalMin);
  const targetDate = target ? new Date(target) : null;
  const slack = targetDate ? differenceInMinutes(targetDate, forecast) : null;
  let cursor = now;
  const steps = actions.map(a => { const s = cursor; cursor = addMinutes(cursor, a.duration_min); return { a, s, e: cursor }; });

  const okTitle = !!title.trim();
  const okMembers = members.length > 0;
  const okPlan = actions.length > 0;
  const ready = okTitle && okMembers && okPlan;

  const submit = async () => {
    if (!ready) return;
    setCreating(true);
    const room = await createWarRoom(title.trim(), description.trim(), members, {
      targetAt: targetDate ? targetDate.toISOString() : null,
      actions,
      board_id: card?.board,
      column_id: card?.column,
    });
    setCreating(false);
    if (room) onCreated(room);
  };

  const dropAt = (to: number) => {
    if (dragIdx === null || dragIdx === to) { setDragIdx(null); setOverIdx(null); return; }
    setActions(list => { const nx = [...list]; const [it] = nx.splice(dragIdx, 1); nx.splice(to, 0, it); return nx; });
    setDragIdx(null); setOverIdx(null);
  };

  const cardLabel = card ? `${boards.find(b => b.id === card.board)?.name || ''} › ${columns.find(c => c.id === card.column)?.name || ''}` : '';

  return (
    <div className="dk-pg wn-pg">
      <main className={n('panel')} aria-label="Nova War Room">
        <div className={n('hd')}>
          <button type="button" className={n('bk')} aria-label="Voltar" onClick={onCancel}><Ico name="back" size={18} /></button>
          <h1><Ico name="siren" size={17} /> Nova War Room</h1>
        </div>

        <section className={n('sec')}>
          <div className={n('fl')}><label htmlFor="wn-t1">Título do Incidente *</label>
            <input id="wn-t1" className={n('in fc')} type="text" placeholder="Ex: Queda do sistema de produção" value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div className={n('fl')}><label htmlFor="wn-t2">Descrição</label>
            <textarea id="wn-t2" className={n('in ta')} placeholder="Descreva o ocorrido..." value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className={n('rw')}><div className={n('fl')}><label htmlFor="wn-t3">Meta de resolução</label>
            <input id="wn-t3" className={n('in')} type="datetime-local" value={target} onChange={e => setTarget(e.target.value)} />
            <span className={n('hp')}>Usada para avisar se a previsão passar da meta.</span></div></div>
        </section>

        <section className={n('sec')}>
          <div className={n('fl')}><span className={n('lab')}>Responsáveis Convocados *</span>
            <input className={n('in')} type="text" placeholder="Buscar funcionário..." aria-label="Buscar funcionário" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className={n('pl')} style={{ maxHeight: 260, overflow: 'auto' }}>
            {filtered.map(p => (
              <label key={p.id} className={n('pr')}>
                <input type="checkbox" checked={members.includes(p.id)} onChange={e => setMembers(prev => e.target.checked ? [...prev, p.id] : prev.filter(x => x !== p.id))} />
                <Av p={n} person={p} size={30} />
                <span className={n('pn')}>{nameOf(p)}</span><span className={n('pc')}>{p.autonomy_level || ''}</span>
              </label>
            ))}
          </div>
          <div className={n('sm')}>{members.length} selecionado{members.length === 1 ? '' : 's'}</div>
        </section>

        <section className={n('sec')}>
          <div><span className={n('lab')}>Plano de ação (Timeline) *</span>
            <div className={n('hp')} style={{ marginTop: 3 }}>Adicione as ações que devem ser executadas antes de lançar o alerta.</div></div>
          <div className={n('addr')}>
            <input className={n('in')} type="text" placeholder="Ex: Isolar serviço X e validar logs" aria-label="Nova ação" value={draft.title}
              onChange={e => setDraft({ ...draft, title: e.target.value })} onKeyDown={e => e.key === 'Enter' && add()} />
            <Sel className={n('in')} style={{ width: 150 }} aria-label="Responsável" value={draft.assigned_to || ''} onChange={e => setDraft({ ...draft, assigned_to: e.target.value || null })}>
              <option value="">Responsável</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}
            </Sel>
            <input className={n('in')} type="text" inputMode="numeric" placeholder="min" style={{ width: 70 }} aria-label="Duração em minutos" value={draftMin}
              onChange={e => setDraftMin(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && add()} />
            <button type="button" className={n('btn sq')} aria-label="Adicionar ação" onClick={add}>+</button>
          </div>
          {actions.length > 0 && (
            <div className={n('lst')}>
              {actions.map((a, i) => (
                <div key={i} className={n(`ac${overIdx === i && dragIdx !== null ? ' drop' : ''}`)} draggable={editing === null}
                  onDragStart={() => setDragIdx(i)} onDragOver={e => { e.preventDefault(); setOverIdx(i); }} onDrop={() => dropAt(i)} onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}>
                  <span className={n('gp')} aria-label="Arrastar para reordenar"><Grip /></span>
                  <span className={n('nn')}>{i + 1}</span>
                  {editing === i ? (
                    <>
                      <div className={n('edit')}>
                        <input style={{ flex: 1 }} value={editDraft.title} onChange={e => setEditDraft({ ...editDraft, title: e.target.value })} />
                        <Sel style={{ width: 130 }} value={editDraft.assigned_to || ''} onChange={e => setEditDraft({ ...editDraft, assigned_to: e.target.value || null })}>
                          <option value="">Sem responsável</option>
                          {profiles.map(p => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}
                        </Sel>
                        <input style={{ width: 60 }} value={editDraft.duration_min} inputMode="numeric"
                          onChange={e => setEditDraft({ ...editDraft, duration_min: Math.max(1, parseInt(e.target.value.replace(/\D/g, ''), 10) || 1) })} />
                      </div>
                      <button type="button" className={n('ic')} aria-label="Salvar" onClick={() => { if (editDraft.title.trim()) { setActions(l2 => l2.map((x, k) => k === i ? { ...editDraft, title: editDraft.title.trim() } : x)); setEditing(null); } }}><Ico name="check" /></button>
                      <button type="button" className={n('ic')} aria-label="Cancelar" onClick={() => setEditing(null)}><Ico name="x" /></button>
                    </>
                  ) : (
                    <>
                      <div className={n('at')}>{a.title}</div>
                      <span className={n('wh')}>{a.assigned_to ? <><Av p={n} person={person(a.assigned_to)} />{nameOf(person(a.assigned_to))}</> : 'Sem responsável'}</span>
                      <span className={n('du')}>{a.duration_min} min</span>
                      <button type="button" className={n('ic')} aria-label="Editar" onClick={() => { setEditing(i); setEditDraft(a); }}><Ico name="edit" /></button>
                      <button type="button" className={n('ic')} aria-label="Remover" onClick={() => setActions(l2 => l2.filter((_, k) => k !== i))}><Ico name="x" /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className={n('sm')}>{actions.length} {actions.length === 1 ? 'ação' : 'ações'} · {fmtDur(totalMin)} no total · arraste para mudar a ordem</div>
        </section>

        <section className={n('sec')}>
          <div className={n('cd')}>
            <div><b>Card emergencial (opcional)</b>
              <span className={n('hp')}>{card ? cardLabel : 'Escolha o quadro e a coluna; o resto vem da sala.'}</span></div>
            <div style={{ display: 'flex', gap: 8 }}>
              {card && <button type="button" className={n('btn')} onClick={() => setCard(null)}>Remover</button>}
              <button type="button" className={n('btn')} onClick={() => setCardModal(true)}><Ico name="card" /> {card ? 'Alterar card' : 'Configurar card'}</button>
            </div>
          </div>
        </section>

        <div className={n('ft')}>
          <button type="button" className={n('btn')} onClick={onCancel}>Cancelar</button>
          <button type="button" className={n('btn red')} disabled={!ready || creating} onClick={submit}>{creating ? 'Lançando...' : 'Lançar alerta e ativar War Room'}</button>
        </div>
      </main>

      <aside className={n('panel sd')} aria-label="Prévia">
        <div className={n('sdh')}>Prévia da timeline</div>
        <div className={n('sdb')}>
          <div className={n('kv')}><span>Ações planejadas</span><b>{actions.length}</b></div>
          <div className={n('kv')}><span>Duração estimada</span><b>{fmtDur(totalMin)}</b></div>
          <div className={n('kv')}><span>Previsão de conclusão</span><b className={n('big')}>{hhmm(forecast)}</b></div>
          <div className={n('kv')}><span>Meta de resolução</span><b>{targetDate ? hhmm(targetDate) : '—'}</b></div>
          {slack !== null && (
            <div className={n('ok')} style={slack < 0 ? { color: '#B3261E' } : undefined}>
              {slack >= 0 ? `${slack} min de folga em relação à meta` : `${Math.abs(slack)} min acima da meta`}
            </div>
          )}
        </div>
        <div className={n('sdb')}><div className={n('tm')}>
          <div className={n('ti')}><span className={n('dt r')} /><div><b>Lançamento do alerta</b><span>{hhmm(now)}</span></div></div>
          {steps.map((st, i) => (
            <div key={i} className={n('ti')}><span className={n('dt')} /><div><b>{st.a.title}</b><span>{hhmm(st.s)} – {hhmm(st.e)}</span></div></div>
          ))}
          {actions.length > 0 && <div className={n('ti')}><span className={n('dt g')} /><div><b>Previsão de conclusão</b><span>{hhmm(forecast)}</span></div></div>}
        </div></div>
        <div className={n('sdb')}>
          <div className={n('lab')} style={{ marginBottom: 6 }}>Antes de lançar</div>
          {[
            { ok: okTitle, label: 'Título do incidente' },
            { ok: okMembers, label: `Responsáveis convocados (${members.length})` },
            { ok: okPlan, label: `Plano de ação (${actions.length} ${actions.length === 1 ? 'ação' : 'ações'})` },
            { ok: !!card, label: 'Card emergencial (opcional)' },
          ].map(c => (
            <div key={c.label} className={n('ck')}>
              <span className={n(c.ok ? 'cc' : 'cc o')}>{c.ok && <Ico name="check" size={13} />}</span>{c.label}
            </div>
          ))}
        </div>
        <div className={n('nt')}>A previsão é recalculada pelo sistema conforme as ações são concluídas ou atrasam.</div>
      </aside>

      {cardModal && (
        <CardPickerModal initialBoard={card?.board} initialColumn={card?.column} confirmText="Salvar configuração"
          onClose={() => setCardModal(false)} onConfirm={(b, c) => { setCard({ board: b, column: c }); setCardModal(false); }} />
      )}
    </div>
  );
}

/* ───────── sala (detalhe) ───────── */

type SortMode = 'manual' | 'time' | 'status' | 'owner';

function WarRoomDetail({ room: initial, onBack }: { room: WarRoom; onBack: () => void }) {
  const [room, setRoom] = useState(initial);
  const detail = useWarRoomDetail(room.id, room.created_by);
  const { members, timeline, messages, actions, loading, acknowledge, sendMessage, addAction, updateAction, deleteAction, moveAction, reorderActions, clearHistory, setActionDone, isRoomCreator } = detail;
  const { user, profile } = useAuth();
  const { closeWarRoom, createEmergencyCard } = useWarRooms();
  const profiles = useProfiles();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<'line' | 'log'>('line');
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
  const [sort, setSort] = useState<SortMode>('manual');
  const [msg, setMsg] = useState('');
  const [draft, setDraft] = useState<{ title: string; who: string; min: string }>({ title: '', who: '', min: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [ed, setEd] = useState<{ title: string; who: string; min: string }>({ title: '', who: '', min: '' });
  const [menuId, setMenuId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [cardModal, setCardModal] = useState(false);
  const [cvOpen, setCvOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(t); }, []);
  const now = useMemo(() => new Date(), [tick, actions, room.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = room.status === 'active';
  const canManage = isActive && (isRoomCreator || profile?.autonomy_level === 'admin');

  useEffect(() => {
    const ch = supabase.channel(`wr-room-${room.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'war_rooms', filter: `id=eq.${room.id}` }, p => setRoom(r => ({ ...r, ...(p.new as any) })))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [room.id]);

  const me = members.find(m => m.user_id === user?.id);
  const needsAck = me && !me.has_acknowledged;
  useEffect(() => { if (needsAck) acknowledge(); }, [needsAck, acknowledge]);

  const person = useCallback((id: string | null) => profiles.find(p => p.id === id) || null, [profiles]);
  const creator = profiles.find(p => p.user_id === room.created_by);

  const sorted = useMemo(() => [...actions].sort((a, b) => a.position - b.position), [actions]);
  const { rows, forecast } = useMemo(() => buildSchedule(room, sorted, now), [room, sorted, now]);
  const firstPending = sorted.find(a => a.status === 'pending');
  const doneCount = sorted.filter(a => a.status === 'done').length;
  const pendingCount = sorted.length - doneCount - (firstPending ? 1 : 0);
  const remaining = sorted.filter(a => a.status === 'pending').reduce((s, a) => s + a.duration_min, 0);
  const pct = sorted.length ? Math.round((doneCount / sorted.length) * 100) : 0;
  const target = room.target_at ? new Date(room.target_at) : null;
  const end = isActive ? forecast : new Date(room.closed_at || forecast);
  const ms = metaStatus(target, isActive ? forecast : end, !isActive);
  const elapsedMin = differenceInMinutes(isActive ? now : new Date(room.closed_at || now), new Date(room.created_at));

  const visible = useMemo(() => {
    let list = sorted.filter(a => filter === 'all' || (filter === 'done' ? a.status === 'done' : a.status === 'pending'));
    if (sort === 'time') list = [...list].sort((a, b) => (rows.get(a.id)?.start.getTime() || 0) - (rows.get(b.id)?.start.getTime() || 0));
    if (sort === 'status') {
      const rank = (a: WarRoomAction) => (a.status === 'done' ? 2 : a.id === firstPending?.id ? 0 : 1);
      list = [...list].sort((a, b) => rank(a) - rank(b));
    }
    if (sort === 'owner') list = [...list].sort((a, b) => nameOf(person(a.assigned_to)).localeCompare(nameOf(person(b.assigned_to))));
    return list;
  }, [sorted, filter, sort, rows, firstPending, person]);

  /* chat + eventos do sistema */
  const feed = useMemo(() => {
    const items: Array<{ at: number; kind: 'msg' | 'sys'; id: string; msg?: typeof messages[number]; text?: string; ok?: boolean }> = [];
    messages.forEach(m => items.push({ at: new Date(m.created_at).getTime(), kind: 'msg', id: 'm' + m.id, msg: m }));
    timeline.forEach(t => {
      const time = hhmm(new Date(t.created_at));
      const isCreate = /criada$/.test(t.content);
      const ok = t.content.startsWith('Ação concluída');
      items.push({ at: new Date(t.created_at).getTime(), kind: 'sys', id: 't' + t.id, ok,
        text: isCreate ? `War Room criada por ${t.creator_name || 'Sistema'} às ${time}` : `${t.content} · ${time}` });
    });
    return items.sort((a, b) => a.at - b.at);
  }, [messages, timeline]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [feed.length]);

  const openCard = async () => {
    if (!room.task_id) return;
    let boardId = room.emergency_board_id;
    if (!boardId) {
      const { data } = await supabase.from('tasks').select('board_id').eq('id', room.task_id).maybeSingle();
      boardId = (data as any)?.board_id || null;
    }
    if (!boardId) return;
    const next = new URLSearchParams(searchParams);
    next.set('section', 'tasks'); next.set('board', boardId); next.set('task', room.task_id);
    setSearchParams(next);
  };

  const send = async () => {
    if (!msg.trim()) return;
    const m = msg; setMsg('');
    if (!(await sendMessage(m))) setMsg(m);
  };

  const addNew = async () => {
    if (!draft.title.trim()) return;
    const ok = await addAction({ title: draft.title, assigned_to: draft.who || null, duration_min: Math.max(1, parseInt(draft.min, 10) || 15) });
    if (ok) setDraft({ title: '', who: '', min: '' });
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

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId || sort !== 'manual' || filter !== 'all') { setDragId(null); setOverId(null); return; }
    const ids = sorted.map(a => a.id);
    const from = ids.indexOf(dragId), to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setDragId(null); setOverId(null);
    reorderActions(ids);
  };

  if (loading) {
    return <div className="dk-pg wd-pg" style={{ alignItems: 'center', justifyContent: 'center', color: '#4A5563' }}>Carregando sala...</div>;
  }

  const canToggle = isActive && (Boolean(me) || canManage);
  const confirmed = members.filter(m => m.has_acknowledged).length;

  return (
    <div className="dk-pg wd-pg" onClick={() => { setMenuId(null); setCvOpen(false); }}>
      <header className={d('panel top')}>
        <button type="button" className={d('bk')} aria-label="Voltar" onClick={onBack}><Ico name="back" size={18} /></button>
        <div className={d('sir')}><Ico name="siren" size={22} /></div>
        <div>
          <h1>{room.title} <span className={isActive ? d('live') : d('live')} style={isActive ? undefined : { background: '#5A6472' }}>{isActive ? 'Ativa' : 'Encerrada'}</span></h1>
          <div className={d('sub')}>Aberta em {format(new Date(room.created_at), 'dd/MM/yyyy')} às {hhmm(new Date(room.created_at))}{creator ? ` por ${nameOf(creator)}` : ''}</div>
        </div>
        <div className={d('acts')}>
          <button type="button" className={d('btn')} aria-expanded={cvOpen} onClick={e => { e.stopPropagation(); setCvOpen(o => !o); }}>
            Informações
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: cvOpen ? 'rotate(180deg)' : undefined }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {isRoomCreator && isActive && (
            <button type="button" className={d('btn')} onClick={async () => {
              if (await appConfirm({ title: 'Excluir todo o histórico desta War Room?', message: 'Mensagens e registros serão apagados.', confirmText: 'Excluir histórico', danger: true })) clearHistory();
            }}><Ico name="trash" size={15} /> Excluir histórico</button>
          )}
          {canManage && !room.task_id && <button type="button" className={d('btn')} onClick={() => setCardModal(true)}><Ico name="card" size={15} />Criar card</button>}
          {room.task_id && <button type="button" className={d('btn')} onClick={openCard}><Ico name="card" size={15} />Abrir card</button>}
          {canManage && <button type="button" className={d('btn dg')} onClick={close}><Ico name="xcircle" size={15} />Encerrar</button>}
        </div>
        {cvOpen && (
          <div className={d('info')} onClick={e => e.stopPropagation()}>
            <div className={d('lab')}>Descrição</div>
            <p>{room.description || 'Sem descrição.'}</p>
            <div className={d('lab')} style={{ marginTop: 12 }}>Convocados · {confirmed} de {members.length} confirmaram</div>
            <div className={d('infl')}>
              {members.map((m: WarRoomMember) => (
                <div key={m.id} className={d('pp')}>
                  <Av p={d} person={{ ...(m.profile || {}), autonomy_level: person(m.profile_id)?.autonomy_level }} />
                  <span className={d('n')}>{nameOf(m.profile)}</span>
                  {m.has_acknowledged
                    ? <span className={d('z ok')}><Ico name="check" size={13} /> Confirmou</span>
                    : <span className={d('z no')}>Pendente</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className={d('main')}>
        <section className={d('panel col')} aria-label="Resumo e chat">
          <div className={d('stats')}>
            <div className={d('st')}><div className={d('l')}>Taxa de conclusão</div><div className={d('v')}>{pct}%</div><div className={d('bar')}><i style={{ width: `${pct}%` }} /></div></div>
            <div className={d('st')}><div className={d('l')}>Ações concluídas</div><div className={d('v')}>{doneCount} <small>de {sorted.length}</small></div>
              <div className={d('s')}>{firstPending && isActive ? '1 em andamento' : isActive ? 'Nenhuma em andamento' : 'Sala encerrada'}</div></div>
            <div className={d('st')}><div className={d('l')}>Tempo decorrido</div>
              <div className={d('v')}>{elapsedMin >= 60 ? <>{Math.floor(elapsedMin / 60)}h {String(elapsedMin % 60).padStart(2, '0')}<small>min</small></> : <>{elapsedMin}<small>min</small></>}</div>
              <div className={d('s')}>Desde {hhmm(new Date(room.created_at))}</div></div>
            <div className={d('st')}><div className={d('l')}>{isActive ? 'Previsão de conclusão' : 'Conclusão'}</div><div className={d('v')}>{hhmm(end)}</div>
              {ms ? <div className={d('s')} style={ms.cls === 'ok' ? { color: '#0A6B3D', fontWeight: 600 } : ms.cls === 'late' || ms.cls === 'bad' ? { color: '#B3261E', fontWeight: 600 } : undefined}>{ms.text}</div>
                : <div className={d('s')}>Sem meta definida</div>}</div>
          </div>
          <div className={d('msgs')}>
            {feed.length === 0 && <span className={d('sy')}>Nenhuma mensagem ainda</span>}
            {feed.map(it => it.kind === 'sys' ? (
              <span key={it.id} className={d(it.ok ? 'sy ok' : 'sy')}>{it.ok && <Ico name="check" size={13} />} {it.text}</span>
            ) : (
              <div key={it.id} className={d(it.msg!.sender_id === profile?.id ? 'bb' : 'bb in')}>
                {it.msg!.sender_id !== profile?.id && <b style={{ display: 'block', fontSize: 12, marginBottom: 2 }}>{nameOf(it.msg!.sender)}</b>}
                <span style={{ whiteSpace: 'pre-wrap' }}>{it.msg!.content}</span>
                <time>{hhmm(new Date(it.msg!.created_at))}</time>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          {isActive && (
            <div className={d('cin')}>
              <input className={d('in')} type="text" placeholder="Mensagem..." aria-label="Mensagem" value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()} />
              <button type="button" className={d('sd')} aria-label="Enviar" onClick={send}><Ico name="send" size={17} /></button>
            </div>
          )}
        </section>

        <section className={d('panel col')} aria-label="Linha do tempo">
          <div className={d('tabs')}>
            <button type="button" className={tab === 'line' ? d('on') : ''} onClick={() => setTab('line')}>Linha do tempo</button>
            <button type="button" className={tab === 'log' ? d('on') : ''} onClick={() => setTab('log')}>Registro de alterações</button>
          </div>

          {tab === 'log' ? (
            <div className={d('tlist')} style={{ padding: '14px 20px' }}>
              {timeline.length === 0 && <span style={{ color: '#4A5563' }}>Sem registros.</span>}
              {[...timeline].reverse().map(e => (
                <div key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid #EDEFF2' }}>
                  <div style={{ fontWeight: 500 }}>{e.content}</div>
                  <div style={{ fontSize: 12, color: '#4A5563' }}>{e.creator_name} · {format(new Date(e.created_at), 'dd/MM HH:mm')}</div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className={d('pr')}>
                <div className={d('seg')}>
                  {sorted.map(a => <i key={a.id} className={a.status === 'done' ? d('d') : a.id === firstPending?.id && isActive ? d('p') : ''} />)}
                  {sorted.length === 0 && <i />}
                </div>
                <div className={d('pl')}>
                  <span><b>{doneCount}</b> concluídas · <b>{firstPending && isActive ? 1 : 0}</b> em andamento · <b>{Math.max(0, pendingCount + (firstPending && !isActive ? 1 : 0))}</b> pendentes</span>
                  <span>Restante: <b>{fmtDur(remaining)}</b></span>
                </div>
              </div>
              <div className={d('ctl')}>
                <div className={d('fl')}>
                  <button type="button" className={filter === 'all' ? d('on') : ''} onClick={() => setFilter('all')}>Todas {sorted.length}</button>
                  <button type="button" className={filter === 'open' ? d('on') : ''} onClick={() => setFilter('open')}>Em aberto {sorted.length - doneCount}</button>
                  <button type="button" className={filter === 'done' ? d('on') : ''} onClick={() => setFilter('done')}>Concluídas {doneCount}</button>
                </div>
                <Sel aria-label="Ordenação" value={sort} onChange={e => setSort(e.target.value as SortMode)}>
                  <option value="manual">Ordem: manual (arrastar)</option>
                  <option value="time">Por horário</option>
                  <option value="status">Por status</option>
                  <option value="owner">Por responsável</option>
                </Sel>
              </div>

              <div className={d('tlist')}>
                <div className={d(visible.length === 0 ? 'it last' : 'it')}>
                  <span className={d('gp')} /><div className={d('rail')}><span className={d('cb ev')} /></div>
                  <div className={d('bd')}>
                    <div className={d('r1')}><span className={d('tt')}>War Room criada</span><span className={d('tg t-n')} style={{ color: '#4A5563' }}>{hhmm(new Date(room.created_at))}</span></div>
                    <div className={d('r2')}><Av p={d} person={creator} />{nameOf(creator)} · Evento do sistema</div>
                  </div>
                </div>

                {visible.map((a, i) => {
                  const isDone = a.status === 'done';
                  const cur = isActive && a.id === firstPending?.id;
                  const sch = rows.get(a.id);
                  const owner = person(a.assigned_to);
                  const editing = editId === a.id;
                  const cls = `it ${isDone ? 'done' : cur ? 'prog' : 'pend'}${i === visible.length - 1 ? ' last' : ''}${overId === a.id && dragId ? ' drop' : ''}`;
                  return (
                    <div key={a.id} className={d(cls)} draggable={canManage && sort === 'manual' && filter === 'all' && !editing}
                      onDragStart={() => setDragId(a.id)} onDragOver={e => { if (dragId) { e.preventDefault(); setOverId(a.id); } }} onDrop={() => dropOn(a.id)} onDragEnd={() => { setDragId(null); setOverId(null); }}>
                      <span className={d('gp')} aria-label="Arrastar para reordenar">{canManage && <Grip />}</span>
                      <div className={d('rail')}>
                        <button type="button" className={d(isDone ? 'cb done' : cur ? 'cb prog' : 'cb')} disabled={!canToggle}
                          aria-label={isDone ? 'Marcar como pendente' : 'Marcar como concluída'} onClick={() => setActionDone(a.id, !isDone)}>
                          {isDone ? <Ico name="check" size={13} /> : cur ? <i /> : null}
                        </button>
                      </div>
                      <div className={d('bd')}>
                        <div className={d('r1')}>
                          <span className={d('tt')}>{a.title}</span>
                          <span className={d(`tg ${editing ? 't-p' : isDone ? 't-d' : cur ? 't-p' : 't-n'}`)}>{editing ? 'Editando' : isDone ? 'Concluída' : cur ? 'Em andamento' : 'Pendente'}</span>
                        </div>
                        {!editing && (
                          <div className={d('r2')}><Av p={d} person={owner} />{owner ? nameOf(owner) : 'Sem responsável'} · {a.duration_min} min{sch ? ` · ${hhmm(sch.start)} – ${hhmm(sch.end)}` : ''}</div>
                        )}
                        {editing && (
                          <div className={d('edt')}>
                            <div className={d('f full')}><label htmlFor="wd-e1">Ação</label><input id="wd-e1" className={d('in')} type="text" value={ed.title} onChange={e => setEd({ ...ed, title: e.target.value })} /></div>
                            <div className={d('f')}><label htmlFor="wd-e2">Responsável</label>
                              <Sel id="wd-e2" className={d('in')} value={ed.who} onChange={e => setEd({ ...ed, who: e.target.value })}>
                                <option value="">Sem responsável</option>
                                {profiles.map(p => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}
                              </Sel></div>
                            <div className={d('f')}><label htmlFor="wd-e3">Início previsto</label><input id="wd-e3" className={d('in')} type="text" disabled value={sch ? hhmm(sch.start) : '—'} /></div>
                            <div className={d('f')}><label htmlFor="wd-e4">Duração (min)</label><input id="wd-e4" className={d('in')} type="text" inputMode="numeric" value={ed.min} onChange={e => setEd({ ...ed, min: e.target.value.replace(/\D/g, '') })} /></div>
                            <div className={d('eb')}>
                              <button type="button" className={d('dg')} onClick={async () => { if (await appConfirm({ title: 'Remover esta ação?', message: a.title, confirmText: 'Remover', danger: true })) { await deleteAction(a.id); setEditId(null); } }}><Ico name="trash" size={15} /> Excluir ação</button>
                              <button type="button" className={d('btn')} onClick={() => setEditId(null)}>Cancelar</button>
                              <button type="button" className={d('btn pri')} onClick={async () => {
                                if (!ed.title.trim()) return;
                                if (await updateAction(a.id, { title: ed.title.trim(), assigned_to: ed.who || null, duration_min: Math.max(1, parseInt(ed.min, 10) || a.duration_min) })) setEditId(null);
                              }}>Salvar</button>
                            </div>
                          </div>
                        )}
                      </div>
                      {canManage && !editing && (
                        <div className={d('ia')}>
                          <button type="button" className={d('ic')} aria-label="Editar ação" onClick={e => { e.stopPropagation(); setEditId(a.id); setEd({ title: a.title, who: a.assigned_to || '', min: String(a.duration_min) }); }}><Ico name="edit" /></button>
                          <button type="button" className={d('ic')} aria-label="Mais ações" onClick={e => { e.stopPropagation(); setMenuId(menuId === a.id ? null : a.id); }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
                          </button>
                          {menuId === a.id && (
                            <div className={d('menu')} onClick={e => e.stopPropagation()}>
                              <button type="button" onClick={() => { moveAction(a.id, -1); setMenuId(null); }}>Mover para cima</button>
                              <button type="button" onClick={() => { moveAction(a.id, 1); setMenuId(null); }}>Mover para baixo</button>
                              <button type="button" className={d('dgm')} onClick={async () => { setMenuId(null); if (await appConfirm({ title: 'Remover esta ação?', message: a.title, confirmText: 'Remover', danger: true })) deleteAction(a.id); }}>Excluir ação</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {canManage && (
                <div className={d('add')}>
                  <input className={d('in')} type="text" placeholder="Adicionar ação na timeline..." aria-label="Nova ação" value={draft.title}
                    onChange={e => setDraft({ ...draft, title: e.target.value })} onKeyDown={e => e.key === 'Enter' && addNew()} />
                  <Sel className={d('in')} aria-label="Responsável" style={{ width: 130 }} value={draft.who} onChange={e => setDraft({ ...draft, who: e.target.value })}>
                    <option value="">Responsável</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}
                  </Sel>
                  <input className={d('in')} type="text" inputMode="numeric" placeholder="min" aria-label="Duração" style={{ width: 64 }} value={draft.min}
                    onChange={e => setDraft({ ...draft, min: e.target.value.replace(/\D/g, '') })} onKeyDown={e => e.key === 'Enter' && addNew()} />
                  <button type="button" className={d('btn pri')} onClick={addNew}>Adicionar</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {cardModal && (
        <CardPickerModal confirmText="Criar card" onClose={() => setCardModal(false)} onConfirm={async (b, c) => {
          const r = await createEmergencyCard(room.id, b, c);
          if (r) { setRoom(x => ({ ...x, task_id: r.o_task_id, emergency_board_id: b, emergency_column_id: c })); setCardModal(false); }
        }} />
      )}
      <span hidden>{confirmed}</span>
    </div>
  );
}

/* ───────── lista ───────── */

export function WarRoomSection() {
  const { warRooms, roomActions, roomMembers, loading, canCreateWarRoom, deleteWarRoom, fetchWarRooms } = useWarRooms();
  const [selected, setSelected] = useState<WarRoom | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('all');
  const [q, setQ] = useState('');
  const now = new Date();

  const matches = (r: WarRoom) => !q.trim() || `${r.title} ${r.description || ''}`.toLowerCase().includes(q.toLowerCase());
  const active = warRooms.filter(r => r.status === 'active');
  const closed = warRooms.filter(r => r.status !== 'active');
  const showActive = filter !== 'closed' ? active.filter(matches) : [];
  const showClosed = filter !== 'active' ? closed.filter(matches) : [];

  const remove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!(await appConfirm({ title: 'Excluir esta War Room?', message: 'Esta ação não pode ser desfeita.', confirmText: 'Excluir', danger: true }))) return;
    await deleteWarRoom(id);
  };

  if (creating) return <NewWarRoomForm onCancel={() => setCreating(false)} onCreated={r => { setCreating(false); setSelected(r); fetchWarRooms(); }} />;
  if (selected) return <WarRoomDetail room={selected} onBack={() => { setSelected(null); fetchWarRooms(); }} />;

  const row = (r: WarRoom) => {
    const acts = [...(roomActions[r.id] || [])].sort((a, b) => a.position - b.position);
    const mem = roomMembers[r.id] || [];
    const isActive = r.status === 'active';
    const done = acts.filter(a => a.status === 'done').length;
    const cur = acts.find(a => a.status === 'pending');
    const pct = acts.length ? Math.round((done / acts.length) * 100) : 0;
    const { forecast } = buildSchedule(r, acts, now);
    const target = r.target_at ? new Date(r.target_at) : null;
    const endAt = isActive ? forecast : new Date(r.closed_at || r.updated_at);
    const ms = metaStatus(target, isActive ? forecast : endAt, !isActive);
    const created = new Date(r.created_at);
    return (
      <div key={r.id} className={l('rw')}>
        <div className={l('c1')}>
          <div className={l('tr')}>
            <span className={l('sir')}><Ico name="siren" /></span>
            <div>
              <div className={l('ttl')}>{r.title} <span className={isActive ? l('live') : l('end')}>{isActive ? 'Ativa' : 'Encerrada'}</span></div>
              <div className={l('mt')}>
                {isActive
                  ? `Aberta em ${format(created, 'dd/MM')} às ${hhmm(created)} · há ${fmtDur(differenceInMinutes(now, created)).replace(' min', 'min')}`
                  : `Encerrada em ${format(endAt, 'dd/MM')} às ${hhmm(endAt)} · duração ${fmtDur(differenceInMinutes(endAt, created)).replace(' min', 'min')}`}
              </div>
            </div>
          </div>
          {r.description && <div className={l('ds')}>{r.description}</div>}
          <div className={l('cvd')}>
            {mem.slice(0, 4).map(m => <Av key={m.id} p={l} person={m.profile} />)}
            <span>{mem.filter(m => m.has_acknowledged).length} de {mem.length} confirmaram</span>
          </div>
        </div>
        <div className={l('c2')}>
          <div className={l('lb')}>Linha do tempo</div>
          <div className={l('seg')}>
            {acts.map(a => <i key={a.id} className={a.status === 'done' ? l('d') : isActive && a.id === cur?.id ? l('p') : ''} />)}
            {acts.length === 0 && <i />}
          </div>
          <div className={l('pc')}><b>{pct}%</b><span>{done} de {acts.length} ações</span></div>
          <div className={l('nw')}>{isActive ? (cur ? `Agora: ${cur.title}` : 'Todas as ações concluídas') : 'Concluída'}</div>
        </div>
        <div className={l('c3')}>
          <div className={l('lb')}>{isActive ? 'Previsão de conclusão' : 'Conclusão'}</div>
          <div className={l('pv')}>{dayTime(endAt)}</div>
          {ms ? <div className={l(`ps ${ms.cls}`)}>{ms.text}</div> : <div className={l('ps done')}>Sem meta definida</div>}
        </div>
        <div className={l('c4')}>
          {!isActive && canCreateWarRoom && <button type="button" className={l('del')} aria-label="Excluir War Room" onClick={e => remove(e, r.id)}><Ico name="trash" /></button>}
          <button type="button" className={l('btn')} onClick={() => setSelected(r)}>Abrir</button>
        </div>
      </div>
    );
  };

  return (
    <div className="dk-pg wl-pg">
      <div className={l('bar')}>
        <div className={l('tabs')}>
          <button type="button" className={l(filter === 'active' ? 'tab on' : 'tab')} onClick={() => setFilter('active')}><Ico name="warn" size={15} />Ativas <b>{active.length}</b></button>
          <button type="button" className={l(filter === 'closed' ? 'tab on' : 'tab')} onClick={() => setFilter('closed')}>Histórico <b>{closed.length}</b></button>
          <button type="button" className={l(filter === 'all' ? 'tab on' : 'tab')} onClick={() => setFilter('all')}>Todas <b>{warRooms.length}</b></button>
        </div>
        <div className={l('rt')}>
          <input className={l('srch')} type="text" placeholder="Buscar War Room" aria-label="Buscar War Room" value={q} onChange={e => setQ(e.target.value)} />
          {canCreateWarRoom && <button type="button" className={l('btn red')} onClick={() => setCreating(true)}><Ico name="siren" /> Criar War Room</button>}
        </div>
      </div>

      <div className={l('panel')}>
        {loading ? (
          <div className={l('empty')}>Carregando...</div>
        ) : showActive.length + showClosed.length === 0 ? (
          <div className={l('empty')}>
            <b style={{ display: 'block', color: '#1C2430', marginBottom: 4 }}>Nenhuma War Room encontrada</b>
            {canCreateWarRoom ? 'Crie uma War Room quando houver um incidente crítico.' : 'As War Rooms aparecerão aqui quando forem criadas.'}
          </div>
        ) : (
          <>
            {showActive.length > 0 && <div className={l('gh')}><i style={{ background: '#C62828' }} />Ativas ({showActive.length})</div>}
            {showActive.map(row)}
            {showClosed.length > 0 && <div className={l('gh')}><i style={{ background: '#5A6472' }} />Histórico ({showClosed.length})</div>}
            {showClosed.map(row)}
          </>
        )}
      </div>
    </div>
  );
}
