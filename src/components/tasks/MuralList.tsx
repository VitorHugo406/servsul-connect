// Tarefas — lista de murais (before a board is opened). Faithful port of the owner's design
// "Tarefas - murais" (Tela_de_Avisos_9). CSS in src/styles/task-murals.css (prefix tm-, scope .tm-pg).
// Per mural: cards done / total (templates and archived cards excluded; cards without a due date count),
// overdue cards (not done, due date in the past), members' photos (up to 3 + "+N").
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Edit, Image as ImageIcon, Loader2, MoreVertical, Plus, Trash2 , FileUp, ListChecks, LayoutTemplate, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SignedStorageImage } from '@/components/common/SignedStorageMedia';
import { useFileUpload } from '@/hooks/useFileUpload';
import { toast } from 'sonner';
import { MURAL_COVERS, effectiveBoardBg, isBgImage, isPrivateStorageUrl, muralCover } from './taskConstants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Board = { id: string; name: string; description: string | null; owner_id: string; background_image: string | null; created_at: string };
type Stat = { total: number; done: number; late: number; nodue: number };
type Member = { id: string; name: string; avatar: string | null };
type Sort = 'recent' | 'old' | 'name' | 'custom';
const SORT_LABEL: Record<Sort, string> = { recent: 'Mais recentes', old: 'Mais antigos', name: 'Nome (A–Z)', custom: 'Minha ordem' };
const ORDER_KEY = 'board_order';
const AV_TONES = ['tm-sa', 'tm-m', 'tm-l', 'tm-c'];
const initials = (n: string) => n.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';

function Cover({ board }: { board: Board }) {
  const bg = effectiveBoardBg(board);
  const mc = muralCover(bg);
  if (mc) return <div className="tm-cover" style={{ ['--a' as string]: mc.a, ['--b' as string]: mc.b }} />;
  if (isBgImage(bg)) return <div className="tm-cover">{isPrivateStorageUrl(bg) ? <SignedStorageImage url={bg} alt="" /> : <img src={bg} alt="" loading="lazy" />}</div>;
  return <div className="tm-cover" />;
}

export function MuralList({ boards, userId, onOpen, onCreate, onSave, onDelete, onImport, onMyTasks, onTemplates, onOverview }: {
  onImport?: () => void;
  onMyTasks?: () => void;
  onOverview?: () => void;
  onTemplates?: () => void;
  boards: Board[];
  userId: string | undefined;
  onOpen: (b: Board) => void;
  onCreate: (name: string, description: string, cover: string) => Promise<boolean>;
  onSave: (id: string, name: string, description: string, cover: string | null) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState<'all' | 'mine' | 'done'>('all');
  const [sort, setSort] = useState<Sort>(() => { try { return (localStorage.getItem('tm_sort') as Sort) || 'recent'; } catch { return 'recent'; } });
  const [order, setOrder] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(ORDER_KEY) || '[]'); } catch { return []; } });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [members, setMembers] = useState<Record<string, Member[]>>({});
  // new mural form
  const [showNew, setShowNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [nName, setNName] = useState(''); const [nDesc, setNDesc] = useState(''); const [nCover, setNCover] = useState('cover-navy');
  const [creating, setCreating] = useState(false);
  const { uploadFile, uploading } = useFileUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const ids = useMemo(() => boards.map((b) => b.id).sort().join(','), [boards]);
  useEffect(() => {
    const list = ids ? ids.split(',') : [];
    if (!list.length) { setStats({}); setMembers({}); return; }
    let alive = true;
    void (async () => {
      const [t, m] = await Promise.all([
        db.from('tasks').select('board_id,completed_at,due_date,is_template,is_archived').in('board_id', list).limit(20000),
        db.from('task_board_members').select('board_id,profile_id,joined_at').in('board_id', list).order('joined_at', { ascending: true }),
      ]);
      if (!alive) return;
      const now = Date.now(); const st: Record<string, Stat> = {};
      for (const r of (t.data || []) as { board_id: string; completed_at: string | null; due_date: string | null; is_template: boolean | null; is_archived: boolean | null }[]) {
        if (r.is_template || r.is_archived) continue;
        const s = (st[r.board_id] ||= { total: 0, done: 0, late: 0, nodue: 0 });
        s.total++;
        if (!r.due_date) s.nodue++;
        if (r.completed_at) s.done++; else if (r.due_date && new Date(r.due_date).getTime() < now) s.late++;
      }
      setStats(st);
      const rows = (m.data || []) as { board_id: string; profile_id: string | null }[];
      const pids = [...new Set(rows.map((r) => r.profile_id).filter(Boolean))] as string[];
      const { data: profs } = pids.length ? await db.from('profiles').select('id,name,display_name,avatar_url').in('id', pids) : { data: [] };
      if (!alive) return;
      const pm = new Map(((profs || []) as { id: string; name: string; display_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, { id: p.id, name: p.display_name || p.name || '?', avatar: p.avatar_url }]));
      const mm: Record<string, Member[]> = {};
      for (const r of rows) { const p = r.profile_id && pm.get(r.profile_id); if (p && !(mm[r.board_id] ||= []).some((x) => x.id === p.id)) mm[r.board_id].push(p); }
      setMembers(mm);
    })();
    return () => { alive = false; };
  }, [ids]);

  const shown = useMemo(() => {
    let l = boards.filter((b) => (!q.trim() || (b.name + ' ' + (b.description || '')).toLowerCase().includes(q.trim().toLowerCase())));
    if (flt === 'mine') l = l.filter((b) => b.owner_id === userId);
    if (flt === 'done') l = l.filter((b) => { const s = stats[b.id]; return !!s && s.total > 0 && s.done === s.total; });
    const om = new Map(order.map((id, i) => [id, i]));
    return [...l].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'pt-BR') : sort === 'old' ? a.created_at.localeCompare(b.created_at) : sort === 'custom' ? (om.get(a.id) ?? 999) - (om.get(b.id) ?? 999) : b.created_at.localeCompare(a.created_at));
  }, [boards, q, flt, userId, stats, sort, order]);
  const totalCards = Object.values(stats).reduce((t, s) => t + s.total, 0);

  const setSortP = (s: Sort) => { setSort(s); try { localStorage.setItem('tm_sort', s); } catch { /* ignore */ } };
  const dragOver = (e: React.DragEvent, i: number) => {
    if (sort !== 'custom') return;
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const next = shown.map((b) => b.id); const [mv] = next.splice(dragIdx, 1); next.splice(i, 0, mv);
    const rest = order.filter((id) => !next.includes(id));
    setOrder([...next, ...rest]); try { localStorage.setItem(ORDER_KEY, JSON.stringify([...next, ...rest])); } catch { /* ignore */ }
    setDragIdx(i);
  };

  const openNew = () => { setEditId(null); setShowNew(true); setNName(''); setNDesc(''); setNCover('cover-navy'); window.setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); nameRef.current?.focus(); }, 60); };
  const openEdit = (b: Board) => { setEditId(b.id); setShowNew(true); setNName(b.name); setNDesc(b.description || ''); setNCover(b.background_image || ''); window.setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); nameRef.current?.focus(); }, 60); };
  const closeForm = () => { setShowNew(false); setEditId(null); };
  const submit = async () => {
    if (!nName.trim()) { toast.error('Informe o nome do mural.'); nameRef.current?.focus(); return; }
    setCreating(true);
    const ok = editId ? await onSave(editId, nName.trim(), nDesc.trim(), nCover || null) : await onCreate(nName.trim(), nDesc.trim(), nCover);
    setCreating(false);
    if (ok) closeForm();
  };
  const upload = async (f: File) => {
    if (!f.type.startsWith('image/')) { toast.error('Selecione uma imagem.'); return; }
    const r = await uploadFile(f);
    if (r?.url) setNCover(r.url);
  };
  const preview = muralCover(nCover);
  const renderForm = () => (

            <div className="tm-nw" ref={formRef}>
              <div className="tm-fm">
                <div><h3>{editId ? 'Editar mural' : 'Novo mural'}</h3><div className="tm-hp">{editId ? 'Altere o nome, a descrição e a capa do mural. As colunas e os membros ficam como estão.' : 'Crie um mural individual de tarefas. Você poderá ajustar colunas e membros depois.'}</div></div>
                <div className="tm-f"><label htmlFor="tm-nn">Nome *</label><input id="tm-nn" ref={nameRef} className="tm-in" placeholder="Nome do mural" value={nName} maxLength={80} onChange={(e) => setNName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }} /></div>
                <div className="tm-f"><label htmlFor="tm-nd">Descrição</label><textarea id="tm-nd" className="tm-in tm-ta" placeholder="Descrição opcional" value={nDesc} maxLength={300} onChange={(e) => setNDesc(e.target.value)} /></div>
              </div>
              <div className="tm-fm">
                <div className="tm-f">
                  <span className="tm-lab">Capa</span>
                  <div className="tm-pv" style={preview ? { ['--a' as string]: preview.a, ['--b' as string]: preview.b } : undefined}>
                    {!preview ? (() => { const src = nCover || (editId ? effectiveBoardBg({ id: editId, background_image: null }) : ''); return src ? (isPrivateStorageUrl(src) ? <SignedStorageImage url={src} alt="" /> : <img src={src} alt="" />) : null; })() : null}
                    <span>{nName.trim() || 'Prévia da capa'}</span>
                  </div>
                </div>
                <div className="tm-sws" role="radiogroup" aria-label="Capa do mural">
                  {MURAL_COVERS.map((c) => <span key={c.id} role="radio" tabIndex={0} aria-checked={nCover === c.id} title={c.name} aria-label={'Capa ' + c.name} className={'tm-sw' + (nCover === c.id ? ' tm-on' : '')} style={{ backgroundImage: `linear-gradient(135deg,${c.a},${c.b})` }} onClick={() => setNCover(c.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNCover(c.id); } }} />)}
                  <button type="button" className="tm-btn" style={{ height: 34, padding: '0 14px' }} disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}Enviar imagem</button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
                </div>
                <div className="tm-ac">
                  <button type="button" className="tm-btn" onClick={closeForm} disabled={creating}>Cancelar</button>
                  <button type="button" className="tm-btn tm-pri" onClick={() => void submit()} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{editId ? 'Salvar alterações' : 'Criar mural'}</button>
                </div>
              </div>
            </div>
  );

  return (
    <div className="dk-pg tm-pg">
      <div className="tm-bar">
        <div className="tm-lf">
          <input className="tm-srch" type="text" placeholder="Buscar mural..." aria-label="Buscar mural" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="tm-fl">
            {([['all', 'Todos'], ['mine', 'Meus'], ['done', 'Concluídos']] as const).map(([k, l]) => <button key={k} type="button" className={flt === k ? 'tm-on' : ''} onClick={() => setFlt(k)}>{l}</button>)}
          </div>
          <span className="tm-cn">{boards.length} {boards.length === 1 ? 'mural' : 'murais'} · {totalCards} {totalCards === 1 ? 'card' : 'cards'}</span>
        </div>
        <div className="tm-rt">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" className="tm-btn">{SORT_LABEL[sort]} <ChevronDown className="h-4 w-4" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(SORT_LABEL) as Sort[]).map((s) => <DropdownMenuItem key={s} onClick={() => setSortP(s)}>{SORT_LABEL[s]}{s === 'custom' ? ' (arrastar)' : ''}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          {onMyTasks ? <button type="button" className="tm-btn" onClick={onMyTasks} title="Seus cards de todos os murais"><ListChecks className="h-4 w-4" />Minhas tarefas</button> : null}
          {onOverview ? <button type="button" className="tm-btn" onClick={onOverview} title="Andamento de todos os murais"><BarChart3 className="h-4 w-4" />Visão geral</button> : null}
          {onTemplates || onImport ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><button type="button" className="tm-btn tm-pri"><Plus className="h-4 w-4" />Novo mural<ChevronDown className="h-4 w-4" /></button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={openNew} className="flex items-start gap-2.5 py-2"><Plus className="mt-0.5 h-4 w-4" /><span><b className="block text-sm font-medium">Mural em branco</b><span className="text-xs text-muted-foreground">Comece do zero</span></span></DropdownMenuItem>
                {onTemplates ? <DropdownMenuItem onClick={onTemplates} className="flex items-start gap-2.5 py-2"><LayoutTemplate className="mt-0.5 h-4 w-4" /><span><b className="block text-sm font-medium">A partir de um modelo</b><span className="text-xs text-muted-foreground">33 modelos prontos por área</span></span></DropdownMenuItem> : null}
                {onImport ? <DropdownMenuItem onClick={onImport} className="flex items-start gap-2.5 py-2"><FileUp className="mt-0.5 h-4 w-4" /><span><b className="block text-sm font-medium">Importar</b><span className="text-xs text-muted-foreground">Trello, ClickUp, Asana ou planilha</span></span></DropdownMenuItem> : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : <button type="button" className="tm-btn tm-pri" onClick={openNew}><Plus className="h-4 w-4" />Novo mural</button>}
        </div>
      </div>

      {!boards.length && !showNew ? (
        <div className="tm-empty"><b style={{ display: 'block', fontSize: 16, color: 'var(--dkx-tx-1c2430,#1C2430)', marginBottom: 4 }}>Nenhum mural ainda</b>Crie o primeiro mural de tarefas da sua equipe.<div style={{ marginTop: 16 }}><button type="button" className="tm-btn tm-pri" onClick={openNew}><Plus className="h-4 w-4" />Novo mural</button></div></div>
      ) : (
        <div className="tm-gd">
          {showNew && editId && !shown.some((x) => x.id === editId) ? renderForm() : null}
          {shown.map((b, i) => {
            const s = stats[b.id] || { total: 0, done: 0, late: 0, nodue: 0 };
            const isOpen = open.has(b.id);
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            const mem = members[b.id] || [];
            const owner = b.owner_id === userId;
            if (showNew && editId === b.id) return <div key={b.id} style={{ display: 'contents' }}>{renderForm()}</div>;
            return (
              <div key={b.id} role="button" tabIndex={0} className={'tm-mc' + (dragIdx === i ? ' tm-drag' : '')}
                onClick={() => onOpen(b)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(b); }}
                draggable={sort === 'custom'} onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => dragOver(e, i)} onDragEnd={() => setDragIdx(null)}>
                <div style={{ position: 'relative' }}>
                  <Cover board={b} />
                  {owner ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}><button type="button" className="tm-kb" aria-label="Opções do mural"><MoreVertical className="h-4 w-4" /></button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => openEdit(b)}><Edit className="h-4 w-4 mr-2" /> Editar mural</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onDelete(b.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Excluir mural</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
                <div className="tm-bd">
                  <div className="tm-hd">
                    <div className="tm-tx">
                      <div className="tm-nm">{b.name}</div>
                      {b.description ? <div className="tm-ds" title={b.description}>{b.description}</div> : <div className="tm-dt">Criado em {new Date(b.created_at).toLocaleDateString('pt-BR')}</div>}
                    </div>
                    <button type="button" className={'tm-tog' + (isOpen ? ' tm-on' : '')} aria-expanded={isOpen} aria-label={isOpen ? 'Ocultar resumo do mural' : 'Ver resumo do mural'} title={isOpen ? 'Ocultar resumo' : 'Ver resumo'} onClick={(e) => { e.stopPropagation(); toggle(b.id); }}><ChevronDown className="h-4 w-4" /></button>
                  </div>
                  {isOpen ? (
                    <div className="tm-sum" onClick={(e) => e.stopPropagation()}>
                      <div className="tm-sg">
                        <div className="tm-ring" style={{ background: `conic-gradient(#0A6B3D ${pct * 3.6}deg, #E4E7EC 0)` }} aria-label={pct + '% concluído'}><span>{pct}%</span></div>
                        <div className="tm-kv">
                          <span>Cards</span><b>{s.total}</b>
                          <span>Concluídos</span><b>{s.done}</b>
                          <span>Em aberto</span><b>{s.total - s.done}</b>
                          <span>Atrasados</span><b className={s.late ? 'tm-red' : ''}>{s.late}</b>
                          <span>Sem prazo</span><b>{s.nodue}</b>
                        </div>
                      </div>
                      <div className="tm-mem">
                        <span className="tm-lab">Membros ({mem.length})</span>
                        <div className="tm-avs">
                          {mem.slice(0, 8).map((m, k) => <span key={m.id} className={'tm-av ' + AV_TONES[k % AV_TONES.length]} title={m.name}>{m.avatar ? <img src={m.avatar} alt="" loading="lazy" /> : initials(m.name)}</span>)}
                          {mem.length > 8 ? <span className="tm-av tm-more" title={mem.slice(8).map((m) => m.name).join(', ')}>+{mem.length - 8}</span> : null}
                          {!mem.length ? <span className="tm-dt">Ninguém ainda</span> : null}
                        </div>
                      </div>
                      <div className="tm-ft">
                        <span className="tm-dt">Criado em {new Date(b.created_at).toLocaleDateString('pt-BR')}</span>
                        {s.late > 0 ? <span className="tm-tg tm-rd">{s.late} atrasado(s)</span> : s.total > 0 && s.done === s.total ? <span className="tm-tg tm-gn">Concluído</span> : s.total > 0 ? <span className="tm-tg tm-gn">Em dia</span> : <span className="tm-tg tm-gy">Sem cards</span>}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {!shown.length && boards.length ? <div className="tm-empty" style={{ gridColumn: '1 / -1' }}>Nenhum mural encontrado.</div> : null}
          {showNew && !editId ? renderForm() : null}

        </div>
      )}
    </div>
  );
}
