import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EwwonLoader } from '@/components/common/EwwonLoader';
import { Pin, Pencil, MoreVertical, RotateCcw, Trash2, X, Send, CalendarClock } from 'lucide-react';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { appConfirm } from '@/lib/appDialog';
import { Sel } from '@/components/ui/Sel';
import { useAnnouncementExtras, SectorPicker, useSectorNames, AckStatusDialog, AnnouncementDetailDialog } from '@/components/announcements/AnnouncementExtras';
import { PollEditor, createPoll, emptyPoll, pollReady, type PollDraft } from '@/components/chat/extras/ChatPoll';
import { ShieldCheck, BarChart3, CheckCircle2 } from 'lucide-react';

type Priority = 'normal' | 'important' | 'urgent';
type Status = 'active' | 'scheduled' | 'expired';
type Row = { a: any; status: Status };

const PRIORITY: Record<string, { label: string; cls: string }> = {
  normal: { label: 'Geral', cls: 'dk-gy' },
  important: { label: 'Importante', cls: 'dk-m' },
  urgent: { label: 'Urgente', cls: 'dk-u' },
};
const STATUS: Record<Status, { label: string; cls: string; dot: string; group: string }> = {
  active: { label: 'Ativo', cls: 'dk-s1', dot: '#0A6B3D', group: 'Ativos' },
  scheduled: { label: 'Agendado', cls: 'dk-s2', dot: 'hsl(var(--primary))', group: 'Agendados' },
  expired: { label: 'Expirado', cls: 'dk-s3', dot: '#5A6472', group: 'Expirados' },
};
const DAY = 86400000;
const dm = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
const dmh = (d?: string | null) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const plural = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

function validity(a: any, status: Status) {
  const now = Date.now(), s = a.start_at ? new Date(a.start_at).getTime() : null, e = a.expire_at ? new Date(a.expire_at).getTime() : null;
  if (status === 'scheduled') return { main: `${dmh(a.start_at)}${e ? ` – ${dmh(a.expire_at)}` : ''}`, sub: `Publica em ${plural(Math.max(1, Math.ceil(((s ?? now) - now) / DAY)))}` };
  if (status === 'expired') return { main: `${dm(a.start_at || a.created_at)} – ${dm(a.expire_at)}`, sub: `Expirou há ${plural(Math.max(1, Math.floor((now - (e ?? now)) / DAY)))}` };
  if (!e) return { main: `Desde ${dm(a.start_at || a.created_at)}`, sub: 'Sem data de término' };
  return { main: `${dm(a.start_at || a.created_at)} – ${dm(a.expire_at)}`, sub: `Termina em ${plural(Math.max(0, Math.ceil((e - now) / DAY)))}` };
}

export function AnnouncementsSection() {
  const { announcements, scheduledAnnouncements, expiredAnnouncements, loading, createAnnouncement, updateAnnouncement, deleteAnnouncement, refetch, canManageAnnouncements } = useAnnouncements();
  const { profile, isAdmin } = useAuth();
  const { markAllAnnouncementsAsRead, refetch: refetchNotifications } = useNotifications();
  const [tab, setTab] = useState<'all' | Status>('all');
  const [q, setQ] = useState('');
  const [typeF, setTypeF] = useState('all');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Record<string, { reads: number; total: number }>>({});

  useEffect(() => { markAllAnnouncementsAsRead(); refetchNotifications(); }, [markAllAnnouncementsAsRead, refetchNotifications]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [isPinned, setIsPinned] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [expireAt, setExpireAt] = useState('');
  const [requireAck, setRequireAck] = useState(false);
  const [targets, setTargets] = useState<string[]>([]);
  const [withPoll, setWithPoll] = useState(false);
  const [poll, setPoll] = useState<PollDraft>(emptyPoll);
  const [detail, setDetail] = useState<any | null>(null);
  const [ackFor, setAckFor] = useState<any | null>(null);
  const sectorNames = useSectorNames();

  const openNew = () => { setEditingId(null); setTitle(''); setContent(''); setPriority('normal'); setIsPinned(false); setStartAt(''); setExpireAt(''); setRequireAck(false); setTargets([]); setWithPoll(false); setPoll(emptyPoll()); setShowForm(true); };
  // The create action also lives in the main site header (UI event, so the header knows nothing about this form).
  useEffect(() => {
    const handler = () => { if (canManageAnnouncements) openNew(); };
    window.addEventListener('nuvexa:open-new-announcement', handler);
    return () => window.removeEventListener('nuvexa:open-new-announcement', handler);
  }, [canManageAnnouncements]);

  const localInput = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const openEdit = (a: any) => { setEditingId(a.id); setTitle(a.title); setContent(a.content); setPriority((a.priority as Priority) || 'normal'); setIsPinned(!!a.is_pinned); setStartAt(localInput(a.start_at || a.created_at)); setExpireAt(localInput(a.expire_at)); setRequireAck(!!a.require_ack); setTargets(Array.isArray(a.target_sectors) ? a.target_sectors : []); setWithPoll(false); setPoll(emptyPoll()); setShowForm(true); window.scrollTo?.({ top: 0, behavior: 'smooth' }); };

  useEffect(() => { if (showForm && !startAt) { setStartAt(localInput(new Date().toISOString())); } }, [showForm, startAt]);

  const canDelete = (authorId: string) => profile?.id === authorId || isAdmin;

  const rows: Row[] = useMemo(() => {
    const seen = new Set<string>(); const out: Row[] = [];
    const add = (list: any[], status: Status) => list.forEach(a => { if (!seen.has(a.id)) { seen.add(a.id); out.push({ a, status }); } });
    add(announcements, 'active'); add(scheduledAnnouncements, 'scheduled'); add(expiredAnnouncements, 'expired');
    return out;
  }, [announcements, scheduledAnnouncements, expiredAnnouncements]);

  // Quantas pessoas já leram cada aviso (função do banco, só para quem gerencia avisos).
  const idsKey = rows.map(r => r.a.id).join(',');
  useEffect(() => {
    if (!canManageAnnouncements || !rows.length) { setStats({}); return; }
    let live = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc('announcement_read_stats', { _ids: rows.map(r => r.a.id) }).then(({ data, error }: any) => {
      if (!live || error || !Array.isArray(data)) return;
      const m: Record<string, { reads: number; total: number }> = {};
      data.forEach((d: any) => { m[d.announcement_id] = { reads: d.reads, total: d.total }; });
      setStats(m);
    });
    return () => { live = false; };
  }, [idsKey, canManageAnnouncements]); // eslint-disable-line react-hooks/exhaustive-deps

  const extras = useAnnouncementExtras(rows.map(r => r.a.id));
  const audience = (a: any) => Array.isArray(a.target_sectors) && a.target_sectors.length ? a.target_sectors.map((id: string) => sectorNames.get(id) || 'Setor').join(', ') : 'Todos os usuários';
  const counts = { all: rows.length, active: announcements.length, scheduled: scheduledAnnouncements.length, expired: expiredAnnouncements.length };
  const filtered = rows.filter(r => (tab === 'all' || r.status === tab) && (typeF === 'all' || r.a.priority === typeF) && (!q.trim() || String(r.a.title).toLowerCase().includes(q.trim().toLowerCase())));
  const groups = (['active', 'scheduled', 'expired'] as Status[]).map(s => ({ s, items: filtered.filter(r => r.status === s) })).filter(g => g.items.length);

  const [busy, setBusy] = useState(false);
  const reload = async () => { setBusy(true); try { await refetch(); } finally { setBusy(false); } };
  const handleDelete = async (ids: string[]) => {
    if (!(await appConfirm({ title: ids.length > 1 ? `Excluir ${ids.length} avisos?` : 'Excluir este aviso?', message: 'Eles deixarão de aparecer para todos.', confirmText: 'Excluir', danger: true }))) return;
    let failed = 0;
    setBusy(true);
    for (const id of ids) { const { error } = await deleteAnnouncement(id); if (error) failed++; }
    if (failed) toast.error('Alguns avisos não puderam ser excluídos'); else toast.success(ids.length > 1 ? 'Avisos excluídos' : 'Aviso excluído com sucesso');
    setSel(new Set()); refetchNotifications(); void reload();
  };
  const reactivate = async (a: any) => {
    const { error } = await updateAnnouncement(a.id, { start_at: new Date().toISOString(), expire_at: null });
    if (error) toast.error('Não foi possível reativar'); else { toast.success('Aviso reativado'); void reload(); }
  };
  const togglePin = async (a: any) => {
    const { error } = await updateAnnouncement(a.id, { is_pinned: !a.is_pinned });
    if (error) toast.error('Não foi possível alterar'); else { toast.success(a.is_pinned ? 'Aviso desafixado' : 'Aviso fixado'); void reload(); }
  };
  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Título', 'Conteúdo', 'Tipo', 'Situação', 'Início', 'Fim', 'Leitura'].map(esc).join(';')].concat(filtered.map(({ a, status }) => [a.title, a.content, PRIORITY[a.priority]?.label || 'Geral', STATUS[status].label, dmh(a.start_at || a.created_at), dmh(a.expire_at), stats[a.id] ? `${stats[a.id].reads}/${stats[a.id].total}` : ''].map(esc).join(';')));
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const el = document.createElement('a'); el.href = url; el.download = 'avisos.csv'; el.click(); URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { toast.error('Preencha o título e o conteúdo'); return; }
    if (!startAt) { toast.error('Data de início é obrigatória'); return; }
    if (expireAt && new Date(expireAt) <= new Date()) { toast.error('A data de término já passou: o aviso nasceria expirado e ninguém o veria. Escolha uma data futura ou deixe em branco.'); return; }
    if (expireAt && new Date(expireAt) <= new Date(startAt)) { toast.error('O término precisa ser depois do início.'); return; }
    if (withPoll && !pollReady(poll)) { toast.error('Complete a enquete: pergunta e pelo menos duas opções.'); return; }
    setFormLoading(true);
    const start = new Date(startAt).toISOString(), end = expireAt ? new Date(expireAt).toISOString() : null;
    const extra = extras.ackOn ? { require_ack: requireAck, target_sectors: targets.length ? targets : null } : {};
    let savedId = editingId;
    let error: unknown = null;
    if (editingId) ({ error } = await updateAnnouncement(editingId, { title, content, priority, is_pinned: isPinned, start_at: start, expire_at: end, ...extra }));
    else { const r = await createAnnouncement(title, content, priority, isPinned, start, end, extra); error = r.error; savedId = (r.data as any)?.id || null; }
    if (!error && withPoll && savedId && extras.pollsOn && !extras.polls.has(savedId)) {
      try { await createPoll('announcement', savedId, poll); } catch { toast.error('O aviso foi salvo, mas a enquete não pôde ser criada.'); }
    }
    if (error) { console.error('Error saving announcement:', error); toast.error('Erro ao salvar aviso. Verifique suas permissões.'); }
    else {
      void extras.reload();
      toast.success(editingId ? 'Aviso atualizado' : new Date(startAt) > new Date() ? 'Aviso agendado com sucesso!' : 'Aviso publicado com sucesso!');
      setShowForm(false); setEditingId(null); void reload();
    }
    setFormLoading(false);
  };

  const hasData = announcements.length + scheduledAnnouncements.length + expiredAnnouncements.length > 0;
  if (loading && !hasData) return <div className="dk-pg" style={{ justifyContent: 'center' }}><EwwonLoader inline /></div>;

  const colSpan = canManageAnnouncements ? 8 : 5;
  const renderRow = ({ a, status }: Row) => {
    const v = validity(a, status), st = stats[a.id], pct = st && st.total ? Math.min(100, Math.round((st.reads / st.total) * 100)) : 0;
    return (
      <tr key={a.id} className={status === 'expired' ? 'dk-exp' : undefined}>
        {canManageAnnouncements && <td><input type="checkbox" aria-label="Selecionar" checked={sel.has(a.id)} onChange={() => setSel(prev => { const n = new Set(prev); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })} /></td>}
        <td><div className="dk-ti" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => setDetail(a)} onKeyDown={e => { if (e.key === 'Enter') setDetail(a); }}>{a.is_pinned && <Pin className="mr-1.5 inline h-3.5 w-3.5 text-primary" aria-label="Fixado" />}{a.title}{extras.polls.has(a.id) ? <BarChart3 className="ml-1.5 inline h-3.5 w-3.5 text-muted-foreground" aria-label="Tem enquete" /> : null}{a.require_ack ? (extras.acked.has(a.id) ? <span className="dk-st dk-s1" style={{ marginLeft: 8 }}><CheckCircle2 className="mr-1 inline h-3 w-3" />Lido</span> : <span className="dk-st dk-s2" style={{ marginLeft: 8 }}><ShieldCheck className="mr-1 inline h-3 w-3" />Confirmar leitura</span>) : null}</div><div className="dk-su" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.content}</div></td>
        <td><span className={`dk-ty ${PRIORITY[a.priority]?.cls || 'dk-gy'}`}>{PRIORITY[a.priority]?.label || 'Geral'}</span></td>
        {canManageAnnouncements && <td>{audience(a)}</td>}
        <td>{v.main}<div className="dk-sub">{v.sub}</div></td>
        {canManageAnnouncements && <td>{status === 'scheduled' || !st ? '—' : <div className="dk-rd"><div className="dk-rb"><i style={{ width: `${pct}%` }} /></div>{st.reads}/{st.total}</div>}</td>}
        {canManageAnnouncements ? <td><span className={`dk-st ${STATUS[status].cls}`}>{STATUS[status].label}</span></td> : <td>{a.author?.display_name || a.author?.name || '—'}</td>}
        {canManageAnnouncements && <td className="dk-ac">
          {status === 'expired' ? <button className="dk-ic" aria-label="Reativar" title="Reativar" onClick={() => reactivate(a)}><RotateCcw size={17} /></button> : <button className="dk-ic" aria-label="Editar" title="Editar" onClick={() => openEdit(a)}><Pencil size={17} /></button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className="dk-ic" aria-label="Mais ações"><MoreVertical size={17} /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => togglePin(a)}><Pin className="mr-2 h-4 w-4" />{a.is_pinned ? 'Desafixar' : 'Fixar no topo'}</DropdownMenuItem>
              {a.require_ack ? <DropdownMenuItem onClick={() => setAckFor(a)}><ShieldCheck className="mr-2 h-4 w-4" />Confirmações de leitura</DropdownMenuItem> : null}
              {canDelete(a.author_id) && <DropdownMenuItem className="text-destructive" onClick={() => handleDelete([a.id])}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </td>}
      </tr>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dk-pg" style={{ position: 'relative' }}>
      {busy ? <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(246,247,249,.78)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 120 }}><EwwonLoader inline /></div> : null}
      <AnimatePresence>
        {showForm && canManageAnnouncements && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div className="dk-panel dk-pad">
              <div className="dk-hd"><h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{editingId ? 'Editar aviso' : 'Criar novo aviso'}</h2><button type="button" className="dk-ic dk-sp" onClick={() => setShowForm(false)} aria-label="Fechar formulário"><X size={17} /></button></div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="title">Título *</Label><Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título do aviso" className="h-11 rounded-xl" required /></div>
                <div className="space-y-2"><Label htmlFor="content">Conteúdo *</Label><Textarea id="content" value={content} onChange={e => setContent(e.target.value)} placeholder="Escreva o conteúdo do aviso..." rows={4} className="rounded-xl" required /></div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="startAt"><CalendarClock className="mr-1 inline h-4 w-4" />Data/Hora de início *</Label><Input id="startAt" type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className="h-11 rounded-xl" required /><p className="dk-hp">Agende para o futuro ou publique agora</p></div>
                  <div className="space-y-2"><Label htmlFor="expireAt"><CalendarClock className="mr-1 inline h-4 w-4" />Data/Hora de expiração</Label><Input id="expireAt" type="datetime-local" value={expireAt} onChange={e => setExpireAt(e.target.value)} className="h-11 rounded-xl" /><p className="dk-hp">Deixe em branco para não expirar</p></div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Prioridade</Label>
                    <Select value={priority} onValueChange={v => setPriority(v as Priority)}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="important">Importante</SelectItem><SelectItem value="urgent">Urgente</SelectItem></SelectContent></Select></div>
                  <div className="flex items-center gap-3 pt-0 sm:pt-6"><Switch id="pinned" checked={isPinned} onCheckedChange={setIsPinned} /><Label htmlFor="pinned" className="cursor-pointer"><Pin className="mr-1 inline h-4 w-4" />Fixar no topo</Label></div>
                </div>
                {extras.ackOn ? <>
                  <div className="space-y-2"><Label>Quem vê este aviso</Label><SectorPicker value={targets} onChange={setTargets} /><p className="dk-hp">{targets.length ? 'Só as pessoas dos setores escolhidos (e você) verão o aviso.' : 'Todos os colaboradores da empresa.'}</p></div>
                  <div className="flex items-start gap-3"><Switch id="requireAck" checked={requireAck} onCheckedChange={setRequireAck} /><Label htmlFor="requireAck" className="cursor-pointer"><ShieldCheck className="mr-1 inline h-4 w-4" />Exigir confirmação de leitura<span className="dk-hp block font-normal">Cada pessoa confirma com “Li e concordo” e você vê quem ainda não confirmou.</span></Label></div>
                </> : null}
                {extras.pollsOn && !(editingId && extras.polls.has(editingId)) ? <>
                  <div className="flex items-center gap-3"><Switch id="withPoll" checked={withPoll} onCheckedChange={setWithPoll} /><Label htmlFor="withPoll" className="cursor-pointer"><BarChart3 className="mr-1 inline h-4 w-4" />Incluir enquete no aviso</Label></div>
                  {withPoll ? <div className="rounded-[12px] border border-border p-3"><PollEditor value={poll} onChange={setPoll} /></div> : null}
                </> : null}
                <Button type="submit" disabled={formLoading} className="h-11 w-full gap-2 rounded-full" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                  {formLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Send className="h-4 w-4" />{editingId ? 'Salvar alterações' : startAt && new Date(startAt) > new Date() ? 'Agendar aviso' : 'Publicar aviso'}</>}
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="dk-panel">
        <div className="dk-bar">
          {canManageAnnouncements ? (
            <div className="dk-tabs" role="group" aria-label="Situação">
              {([['all', 'Todos'], ['active', 'Ativos'], ['scheduled', 'Agendados'], ['expired', 'Expirados']] as const).map(([k, l]) => (
                <button key={k} aria-pressed={tab === k} className={`dk-tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}<b>{counts[k]}</b></button>
              ))}
            </div>
          ) : <div className="dk-ti" style={{ fontSize: 16 }}>Avisos da empresa</div>}
          <div className="dk-flt">
            <input type="text" placeholder="Buscar por título" aria-label="Buscar por título" value={q} onChange={e => setQ(e.target.value)} />
            <Sel aria-label="Tipo" value={typeF} onChange={e => setTypeF(e.target.value)}>
              <option value="all">Tipo: todos</option><option value="normal">Geral</option><option value="important">Importante</option><option value="urgent">Urgente</option>
            </Sel>
            {canManageAnnouncements && <button className="dk-btn" onClick={exportCsv}>Exportar</button>}
            {canManageAnnouncements && <button className="dk-btn pri" onClick={openNew}>+ Novo aviso</button>}
          </div>
        </div>
        {sel.size > 0 && canManageAnnouncements && <div className="dk-bar" style={{ background: '#EDF3FD', padding: '10px 24px' }}><span style={{ fontWeight: 600 }}>{sel.size} selecionado{sel.size > 1 ? 's' : ''}</span><button className="dk-btn" onClick={() => handleDelete(Array.from(sel).filter(id => { const r = rows.find(x => x.a.id === id); return r && canDelete(r.a.author_id); }))}><Trash2 size={15} />Excluir selecionados</button></div>}
        {filtered.length === 0 ? <div className="dk-empty"><b>{rows.length === 0 ? 'Nenhum aviso por aqui' : 'Nenhum aviso encontrado'}</b><div className="dk-sub" style={{ marginTop: 6 }}>{rows.length === 0 ? (canManageAnnouncements ? 'Clique em "+ Novo aviso" para criar um comunicado.' : 'Não há avisos publicados ainda.') : 'Ajuste a busca ou os filtros.'}</div></div> : (
          <div className="dk-scroll"><table className="dk-table">
            <thead><tr>
              {canManageAnnouncements && <th style={{ width: 36 }}><input type="checkbox" aria-label="Selecionar todos" checked={sel.size > 0 && sel.size === filtered.length} onChange={e => setSel(e.target.checked ? new Set(filtered.map(r => r.a.id)) : new Set())} /></th>}
              <th>Aviso</th><th>Tipo</th>{canManageAnnouncements && <th>Público</th>}<th>Vigência</th>{canManageAnnouncements && <th>Leitura</th>}<th>{canManageAnnouncements ? 'Situação' : 'Publicado por'}</th>{canManageAnnouncements && <th style={{ width: 96 }} />}
            </tr></thead>
            <tbody>
              {groups.map(g => [
                <tr key={`g-${g.s}`} className="g"><td colSpan={colSpan}><span style={{ background: STATUS[g.s].dot }} />{STATUS[g.s].group} ({g.items.length})</td></tr>,
                ...g.items.map(renderRow),
              ])}
            </tbody>
          </table></div>
        )}
        <div className="dk-ft"><span>Exibindo {filtered.length} de {rows.length} avisos</span><span>Ordenado por situação e data de vigência</span></div>
      </div>
      <AnnouncementDetailDialog a={detail} open={!!detail} onOpenChange={o => { if (!o) setDetail(null); }} pollId={detail ? extras.polls.get(detail.id) : undefined} ackedAt={detail ? extras.acked.get(detail.id) : undefined} onAcked={() => void extras.reload()} audience={detail ? audience(detail) : ''} />
      <AckStatusDialog id={ackFor?.id || null} title={ackFor?.title || ''} open={!!ackFor} onOpenChange={o => { if (!o) setAckFor(null); }} />
    </motion.div>
  );
}
