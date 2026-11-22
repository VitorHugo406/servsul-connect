// Base de conhecimento (wiki): procedures and policies organised by sector ("Toda a empresa" + each sector) with
// sub-pages, full-text search (wiki_search, Portuguese), the same rich editor as Anotações, autosave, version history
// (one version per 10 min per editor, restore) and who-can-see / who-can-edit settings (author, sector manager or
// admin). Tables wiki_pages / wiki_page_versions (migration 20261121010000); the menu item stays hidden until they exist.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, FilePlus2, History, Loader2, Search, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSectors } from '@/hooks/useData';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sel } from '@/components/ui/Sel';
import { RichTextEditor } from '@/components/notes/RichTextEditor';
import { appConfirm, appPrompt } from '@/lib/appDialog';
import { sanitizeHtml } from '@/lib/safeHtml';
import { cn } from '@/lib/utils';
import { usePeople, pname } from '@/components/rh/rhShared';

const db = supabase as any;
type P = { id: string; parent_id: string | null; sector_id: string | null; title: string; content: string; position: number; visibility: 'company' | 'sector'; edit_scope: 'admins' | 'sector' | 'all'; created_by: string | null; updated_by: string | null; updated_at: string };
type V = { id: string; title: string; content: string; edited_by: string | null; created_at: string };
type Hit = { id: string; title: string; sector_id: string | null; snippet: string };

export function WikiSection() {
  const { profile, isAdmin } = useAuth();
  const { sectors } = useSectors();
  const { byId } = usePeople();
  const [pages, setPages] = useState<P[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [draft, setDraft] = useState<{ title: string; content: string } | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hist, setHist] = useState<V[] | null>(null);
  const [preview, setPreview] = useState<V | null>(null);
  const [cfg, setCfg] = useState<P | null>(null);
  const timer = useRef<number | null>(null);
  const load = useCallback(async () => {
    const { data } = await db.from('wiki_pages').select('id,parent_id,sector_id,title,content,position,visibility,edit_scope,created_by,updated_by,updated_at').order('position').order('title');
    setPages(data || []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const page = useMemo(() => (pages || []).find((p) => p.id === sel) || null, [pages, sel]);
  useEffect(() => { setDraft(page ? { title: page.title, content: page.content } : null); setSaving('idle'); }, [page?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const term = q.trim(); if (term.length < 2) { setHits(null); return; }
    const t = window.setTimeout(async () => { const { data } = await db.rpc('wiki_search', { _q: term }); setHits(data || []); }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const sectorName = (id: string | null) => (id ? (sectors || []).find((s: any) => s.id === id)?.name || 'Setor' : 'Toda a empresa');
  const isManagerOf = (sid: string | null) => !!sid && (sectors || []).some((s: any) => s.id === sid && s.manager_id === profile?.id);
  const inSector = (sid: string | null) => !sid || profile?.sector_id === sid;
  const canEdit = (p: P) => isAdmin || p.created_by === profile?.id || p.edit_scope === 'all' || (p.edit_scope === 'sector' && inSector(p.sector_id)) || isManagerOf(p.sector_id);
  const canConfigure = (p: P) => isAdmin || p.created_by === profile?.id || isManagerOf(p.sector_id);

  const persist = useCallback(async (id: string, d: { title: string; content: string }) => {
    setSaving('saving');
    const { data, error } = await db.from('wiki_pages').update({ title: d.title.trim() || 'Sem título', content: sanitizeHtml(d.content) }).eq('id', id).select('id');
    if (error || !data?.length) { setSaving('error'); return; }
    setSaving('saved');
    setPages((ps) => (ps ? ps.map((p) => (p.id === id ? { ...p, title: d.title.trim() || 'Sem título', content: d.content, updated_by: profile?.id || p.updated_by, updated_at: new Date().toISOString() } : p)) : ps));
  }, [profile?.id]);
  const change = (d: { title: string; content: string }) => {
    setDraft(d); if (!page) return;
    if (timer.current) window.clearTimeout(timer.current);
    const id = page.id; timer.current = window.setTimeout(() => void persist(id, d), 1500);
  };
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const create = async (parent: P | null, sectorId: string | null) => {
    const title = await appPrompt({ title: parent ? `Nova subpágina em “${parent.title}”` : 'Nova página', label: 'Título', placeholder: 'Ex.: Como solicitar reembolso', confirmText: 'Criar', maxLength: 200 });
    if (!title?.trim()) return;
    const sid = parent ? parent.sector_id : sectorId;
    const { data, error } = await db.from('wiki_pages').insert({ title: title.trim(), parent_id: parent?.id || null, sector_id: sid, visibility: parent?.visibility || 'company', edit_scope: parent?.edit_scope || 'all', position: (pages || []).filter((p) => p.parent_id === (parent?.id || null)).length }).select('id').single();
    if (error) { toast.error(sid ? 'Você só cria páginas nos setores de que participa.' : 'Não foi possível criar a página.'); return; }
    await load(); setSel(data.id);
  };
  const remove = async (p: P) => {
    const kids = (pages || []).filter((x) => x.parent_id === p.id).length;
    if (!(await appConfirm({ title: `Excluir “${p.title}”?`, message: kids ? `As ${kids} subpágina(s) também serão excluídas.` : 'O histórico de versões também será apagado.', confirmText: 'Excluir', danger: true }))) return;
    const { error } = await db.from('wiki_pages').delete().eq('id', p.id);
    if (error) toast.error('Só quem criou a página ou um administrador pode excluir.'); else { setSel(null); void load(); }
  };
  const openHist = async () => {
    if (!page) return;
    const { data } = await db.from('wiki_page_versions').select('id,title,content,edited_by,created_at').eq('page_id', page.id).order('created_at', { ascending: false }).limit(50);
    setHist(data || []);
  };
  const restore = async (v: V) => {
    if (!page || !(await appConfirm({ title: 'Restaurar esta versão?', message: 'O texto atual vira uma versão no histórico.', confirmText: 'Restaurar' }))) return;
    await persist(page.id, { title: v.title, content: v.content }); setDraft({ title: v.title, content: v.content }); setPreview(null); setHist(null); toast.success('Versão restaurada');
  };
  const saveCfg = async () => {
    if (!cfg) return;
    const { error } = await db.from('wiki_pages').update({ sector_id: cfg.sector_id, visibility: cfg.sector_id ? cfg.visibility : 'company', edit_scope: cfg.edit_scope }).eq('id', cfg.id);
    if (error) toast.error('Não foi possível salvar.'); else { toast.success('Configuração salva'); setCfg(null); void load(); }
  };

  const groups = useMemo(() => {
    const ids = new Set((pages || []).map((p) => p.sector_id));
    const list: { id: string | null; name: string }[] = [{ id: null, name: 'Toda a empresa' }];
    for (const s of (sectors || []) as any[]) if (!s.is_general && (ids.has(s.id) || inSector(s.id) || isAdmin)) list.push({ id: s.id, name: s.name });
    return list;
  }, [pages, sectors, isAdmin, profile?.sector_id]); // eslint-disable-line react-hooks/exhaustive-deps
  const tree = (parent: string | null, sid: string | null, depth: number): React.ReactNode => (pages || []).filter((p) => p.parent_id === parent && (parent || p.sector_id === sid)).map((p) => (
    <div key={p.id}>
      <button type="button" onClick={() => setSel(p.id)} className={cn('flex w-full items-center gap-1.5 rounded-[10px] py-1.5 pr-2 text-left text-sm hover:bg-muted', sel === p.id && 'bg-primary/10 font-medium text-primary')} style={{ paddingLeft: 10 + depth * 14 }}>
        {(pages || []).some((x) => x.parent_id === p.id) ? <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" /> : <span className="w-3.5 shrink-0" />}<span className="truncate">{p.title}</span>
      </button>
      {depth < 3 ? tree(p.id, sid, depth + 1) : null}
    </div>
  ));
  const crumbs = (() => { const out: P[] = []; let cur = page; while (cur?.parent_id) { const par = (pages || []).find((x) => x.id === cur!.parent_id); if (!par) break; out.unshift(par); cur = par; } return out; })();

  return (
    <div className="dk-pg">
      <div className="grid min-h-[calc(100vh-180px)] grid-cols-1 gap-0 md:grid-cols-[300px_1fr]">
        <aside className="dk-panel flex flex-col border-r border-border">
          <div className="flex flex-col gap-2 border-b border-border p-3">
            <label className="flex h-10 items-center gap-2 rounded-[10px] border border-border bg-background px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar na base" aria-label="Buscar na base" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
            <Button size="sm" onClick={() => void create(null, null)}><FilePlus2 className="mr-1.5 h-4 w-4" />Nova página</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {pages === null ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              : hits ? (hits.length ? hits.map((h) => <button key={h.id} type="button" onClick={() => { setSel(h.id); setQ(''); }} className="block w-full rounded-[10px] px-2.5 py-2 text-left hover:bg-muted"><div className="text-sm font-medium">{h.title}</div><div className="text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(h.snippet || '').replace(/«/g, '<b>').replace(/»/g, '</b>')) }} /><div className="mt-0.5 text-[11px] text-muted-foreground">{sectorName(h.sector_id)}</div></button>) : <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nada encontrado.</p>)
              : groups.map((g) => (
                <div key={g.id || 'all'} className="mb-2">
                  <div className="flex items-center justify-between px-2.5 py-1.5"><span className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">{g.name}</span>{g.id === null || inSector(g.id) || isAdmin ? <button type="button" className="rounded-[8px] p-1 text-muted-foreground hover:bg-muted" title="Nova página neste grupo" aria-label={`Nova página em ${g.name}`} onClick={() => void create(null, g.id)}><FilePlus2 className="h-3.5 w-3.5" /></button> : null}</div>
                  {tree(null, g.id, 0)}
                  {!(pages || []).some((p) => !p.parent_id && p.sector_id === g.id) ? <p className="px-2.5 py-1 text-xs text-muted-foreground">Nenhuma página.</p> : null}
                </div>
              ))}
          </div>
        </aside>
        <main className="dk-panel flex min-w-0 flex-col">
          {!page || !draft ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
              <b className="text-lg">Base de conhecimento</b>
              <p className="max-w-md text-sm text-muted-foreground">Guarde aqui procedimentos, políticas e respostas para dúvidas frequentes. Crie páginas para toda a empresa ou para o seu setor, e escolha quem pode editar.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
                <div className="min-w-0 flex-1 text-xs text-muted-foreground">{sectorName(page.sector_id)}{crumbs.map((c) => <span key={c.id}> › <button type="button" className="hover:underline" onClick={() => setSel(c.id)}>{c.title}</button></span>)}</div>
                <span className="text-xs text-muted-foreground">{saving === 'saving' ? 'Salvando…' : saving === 'saved' ? 'Salvo' : saving === 'error' ? 'Sem permissão para editar' : `Atualizada em ${new Date(page.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${page.updated_by ? ` por ${pname(byId.get(page.updated_by))}` : ''}`}</span>
                {canEdit(page) ? <Button variant="outline" size="sm" onClick={() => void create(page, page.sector_id)}><FilePlus2 className="mr-1.5 h-4 w-4" />Subpágina</Button> : null}
                <Button variant="outline" size="sm" onClick={() => void openHist()}><History className="mr-1.5 h-4 w-4" />Histórico</Button>
                {canConfigure(page) ? <Button variant="outline" size="icon" aria-label="Quem vê e quem edita" title="Quem vê e quem edita" onClick={() => setCfg(page)}><Settings2 className="h-4 w-4" /></Button> : null}
                {isAdmin || page.created_by === profile?.id ? <Button variant="outline" size="icon" aria-label="Excluir página" title="Excluir" onClick={() => void remove(page)}><Trash2 className="h-4 w-4" /></Button> : null}
              </div>
              <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
                <input value={draft.title} readOnly={!canEdit(page)} onChange={(e) => change({ ...draft, title: e.target.value })} maxLength={200} aria-label="Título da página" className="mb-3 w-full bg-transparent text-2xl font-semibold outline-none" />
                {!canEdit(page) ? <p className="mb-3 text-xs text-muted-foreground">Somente leitura: {page.edit_scope === 'admins' ? 'só administradores editam esta página.' : 'só pessoas do setor editam esta página.'}</p> : null}
                <RichTextEditor value={draft.content} onChange={(html) => change({ ...draft, content: html })} readOnly={!canEdit(page)} placeholder="Escreva o procedimento, a política ou a resposta…" className="min-h-[50vh]" />
              </div>
            </>
          )}
        </main>
      </div>
      <Dialog open={!!hist} onOpenChange={(o) => { if (!o) { setHist(null); setPreview(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Histórico de versões</DialogTitle><DialogDescription>{page?.title}</DialogDescription></DialogHeader>
          <div className="grid max-h-[60vh] grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
            <div className="flex flex-col gap-1 overflow-auto">{(hist || []).length ? (hist || []).map((v) => <button key={v.id} type="button" onClick={() => setPreview(v)} className={cn('rounded-[10px] px-2.5 py-2 text-left text-sm hover:bg-muted', preview?.id === v.id && 'bg-primary/10')}><div className="font-medium">{new Date(v.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</div><div className="text-xs text-muted-foreground">{v.edited_by ? pname(byId.get(v.edited_by)) : '—'}</div></button>) : <p className="text-sm text-muted-foreground">Ainda não há versões anteriores.</p>}</div>
            <div className="overflow-auto rounded-[12px] border border-border p-3 text-sm">{preview ? <><b className="mb-2 block">{preview.title}</b><div dangerouslySetInnerHTML={{ __html: sanitizeHtml(preview.content) }} /></> : <p className="text-muted-foreground">Escolha uma versão para ver.</p>}</div>
          </div>
          <DialogFooter>{preview && page && canEdit(page) ? <Button onClick={() => void restore(preview)}>Restaurar esta versão</Button> : null}<Button variant="outline" onClick={() => { setHist(null); setPreview(null); }}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!cfg} onOpenChange={(o) => { if (!o) setCfg(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Quem vê e quem edita</DialogTitle><DialogDescription>{cfg?.title}</DialogDescription></DialogHeader>
          {cfg ? <div className="flex flex-col gap-3">
            <div><label className="mb-1 block text-xs font-semibold">Grupo</label><Sel className="ui-sel w-full" value={cfg.sector_id || ''} onChange={(e) => setCfg({ ...cfg, sector_id: e.target.value || null })} aria-label="Grupo"><option value="">Toda a empresa</option>{((sectors || []) as any[]).filter((s) => !s.is_general).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Sel></div>
            {cfg.sector_id ? <div><label className="mb-1 block text-xs font-semibold">Quem vê</label><Sel className="ui-sel w-full" value={cfg.visibility} onChange={(e) => setCfg({ ...cfg, visibility: e.target.value as P['visibility'] })} aria-label="Quem vê"><option value="company">Toda a empresa</option><option value="sector">Só o setor</option></Sel></div> : null}
            <div><label className="mb-1 block text-xs font-semibold">Quem edita</label><Sel className="ui-sel w-full" value={cfg.edit_scope} onChange={(e) => setCfg({ ...cfg, edit_scope: e.target.value as P['edit_scope'] })} aria-label="Quem edita"><option value="all">Qualquer pessoa que vê</option><option value="sector">Só pessoas do setor</option><option value="admins">Só administradores (e quem criou)</option></Sel></div>
          </div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setCfg(null)}>Cancelar</Button><Button onClick={() => void saveCfg()}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
