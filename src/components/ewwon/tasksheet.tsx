// Mobile "Tarefas pelo chat": create a task in a board column or move an
// existing task, then post a task card in the conversation.
import { useEffect, useMemo, useState } from 'react';
import * as CT from '@/lib/chatTasks';
import type { ChatBoard, ChatColumn, ChatTask } from '@/lib/chatTasks';
import { Seg } from './EwwonApp';
import { I } from './icons';

export function TasksSheet({ mode: initial, meId, people, toast, post, close }: {
  mode: 0 | 1; meId: string; people: Record<string, { id: string; n: string; sys?: boolean }>;
  toast: (t: string) => void; post: (text: string) => void; close: () => void;
}) {
  const [mode, setMode] = useState<number>(initial);
  const [boards, setBoards] = useState<ChatBoard[] | null>(null);
  const [boardId, setBoardId] = useState('');
  const [cols, setCols] = useState<ChatColumn[]>([]);
  const [tasks, setTasks] = useState<ChatTask[]>([]);
  const [colId, setColId] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [prio, setPrio] = useState(1);
  const [due, setDue] = useState('');
  const [who, setWho] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<ChatTask | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    CT.listBoards().then((b) => { setBoards(b); if (b.length === 1) setBoardId(b[0].id); }).catch(() => setBoards([]));
  }, []);
  useEffect(() => {
    if (!boardId) { setCols([]); setTasks([]); return; }
    setColId(''); setSel(null);
    void Promise.all([CT.listColumns(boardId), CT.listTasks(boardId)]).then(([c, t]) => { setCols(c); setTasks(t); if (c[0]) setColId(c[0].id); }).catch(() => toast('Não foi possível abrir o quadro'));
  }, [boardId, toast]);

  const board = boards?.find((b) => b.id === boardId);
  const colOf = (id: string) => cols.find((c) => c.id === id);
  const shown = useMemo(() => tasks.filter((t) => !q.trim() || `#${t.task_number} ${t.title}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40), [tasks, q]);

  const create = async () => {
    const col = colOf(colId);
    if (!col || !board) return;
    setBusy(true);
    try {
      const t = await CT.createTask({ boardId, column: col, title, description: desc, priority: ['low', 'medium', 'high', 'urgent'][prio], dueDate: due ? new Date(due + 'T12:00:00').toISOString() : null, assignedTo: who || null, meProfileId: meId });
      post(CT.cardMessage(t, board.name, `✅ Nova tarefa em ${col.title}`, desc.trim() || undefined));
      toast('Tarefa criada');
      close();
    } catch (e) {
      console.warn(e);
      toast('Não foi possível criar a tarefa');
    } finally { setBusy(false); }
  };

  const move = async (target: ChatColumn) => {
    if (!sel || !board || target.id === sel.status) return;
    setBusy(true);
    try {
      const from = colOf(sel.status);
      await CT.moveTask(sel, boardId, target, from);
      post(CT.cardMessage({ ...sel, status: target.id }, board.name, `➡️ Movida de ${from?.title || '—'} para ${target.title}`));
      toast(`Movida para ${target.title}`);
      close();
    } catch (e) {
      console.warn(e);
      toast('Não foi possível mover a tarefa');
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="gp" />
      <div className="shh"><div><b>Tarefas pelo chat</b><small>Quadros que você já acessa</small></div></div>
      <Seg id="tm" items={['Criar tarefa', 'Mover tarefa']} value={mode} onChange={setMode} />
      <div className="sl">Quadro</div>
      {boards === null ? <div className="hint">Carregando quadros…</div> : !boards.length ? <div className="hint">Você ainda não participa de nenhum quadro.</div> : (
        <div className="ewx-chips">{boards.map((b) => <button key={b.id} className={b.id === boardId ? 'on' : ''} onClick={() => setBoardId(b.id)}>{b.name}</button>)}</div>
      )}
      {boardId && mode === 0 ? (
        <>
          <div className="sl">Coluna</div>
          <div className="ewx-chips">{cols.map((c) => <button key={c.id} className={c.id === colId ? 'on' : ''} onClick={() => setColId(c.id)}><i style={{ background: c.color }} />{c.title}</button>)}</div>
          <div className="sl">Título</div>
          <input className="fld" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito?" />
          <div className="sl">Descrição (opcional)</div>
          <textarea className="fld" rows={2} value={desc} maxLength={1000} onChange={(e) => setDesc(e.target.value)} />
          <div className="sl">Prioridade</div>
          <Seg id="tp" items={['Baixa', 'Média', 'Alta', 'Urgente']} value={prio} onChange={setPrio} />
          <div className="ewx-row2">
            <label><span className="sl">Prazo</span><input className="fld" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
            <label><span className="sl">Responsável</span>
              <select className="fld" value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">Ninguém</option>
                <option value={meId}>Eu</option>
                {Object.values(people).filter((p) => p.id !== meId && !p.sys).map((p) => <option key={p.id} value={p.id}>{p.n}</option>)}
              </select>
            </label>
          </div>
          <button className="btn full" style={{ marginTop: 14 }} disabled={busy || title.trim().length < 2 || !colId} onClick={() => void create()}>{busy ? 'Criando…' : 'Criar e enviar no chat'}</button>
        </>
      ) : null}
      {boardId && mode === 1 ? (
        <>
          <label className="srch" style={{ margin: '12px 0 8px' }}><I n="search" /><input placeholder="Buscar tarefa por número ou título" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {!sel ? (
            shown.length ? shown.map((t) => (
              <div key={t.id} className="opt" onClick={() => setSel(t)}>
                <div>#{t.task_number} · {t.title}<small><i className="ewx-dot" style={{ background: colOf(t.status)?.color }} />{colOf(t.status)?.title || '—'}</small></div>
              </div>
            )) : <div className="hint" style={{ padding: 16 }}>Nenhuma tarefa encontrada</div>
          ) : (
            <>
              <div className="opt" onClick={() => setSel(null)}><div>#{sel.task_number} · {sel.title}<small>Atual: {colOf(sel.status)?.title} · toque para trocar a tarefa</small></div></div>
              <div className="sl">Mover para</div>
              {cols.map((c) => (
                <div key={c.id} className={'opt' + (c.id === sel.status ? ' ewx-cur' : '')} onClick={() => void move(c)}>
                  <i className="ewx-dot big" style={{ background: c.color }} /><div>{c.title}<small>{c.is_conclusion ? 'Conclui a tarefa' : c.id === sel.status ? 'Coluna atual' : ''}</small></div>
                </div>
              ))}
            </>
          )}
        </>
      ) : null}
    </>
  );
}
