// "Links" inside the card: external files and pages (Google Drive/Docs/Sheets, OneDrive/SharePoint, Dropbox, Figma,
// Notion, YouTube, GitHub, Canva, Miro or any https link) stored in task_links. Nothing is downloaded: the card keeps the
// address and a recognisable name/badge; access rules stay with the original service.
import { useEffect, useState } from 'react';
import { ExternalLink, Link as LinkIcon, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const db = supabase as any;
type L = { id: string; url: string; title: string | null };
const KINDS: [RegExp, string, string][] = [
  [/docs\.google\.com\/document/, 'Google Docs', '#2563eb'], [/docs\.google\.com\/spreadsheets/, 'Google Planilhas', '#16a34a'], [/docs\.google\.com\/presentation/, 'Google Apresentações', '#d97706'],
  [/drive\.google\.com/, 'Google Drive', '#1a73e8'], [/(onedrive\.live\.com|1drv\.ms|sharepoint\.com)/, 'OneDrive', '#0364b8'], [/dropbox\.com/, 'Dropbox', '#0061fe'],
  [/figma\.com/, 'Figma', '#a259ff'], [/notion\.(so|site)/, 'Notion', '#111827'], [/(youtube\.com|youtu\.be)/, 'YouTube', '#ff0000'], [/github\.com/, 'GitHub', '#24292f'],
  [/canva\.com/, 'Canva', '#00c4cc'], [/miro\.com/, 'Miro', '#ffd02f'], [/loom\.com/, 'Loom', '#625df5'],
];
export const linkKind = (url: string) => { for (const [re, name, color] of KINDS) if (re.test(url)) return { name, color }; try { return { name: new URL(url).hostname.replace(/^www\./, ''), color: '#6b7280' }; } catch { return { name: 'Link', color: '#6b7280' }; } };

export function CardLinks({ taskId, readOnly }: { taskId: string; readOnly?: boolean }) {
  const [list, setList] = useState<L[]>([]);
  const [url, setUrl] = useState(''); const [title, setTitle] = useState(''); const [adding, setAdding] = useState(false);
  const load = async () => { const { data } = await db.from('task_links').select('id,url,title').eq('task_id', taskId).order('created_at'); setList(data || []); };
  useEffect(() => { void load(); }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps
  const add = async () => {
    let u = url.trim(); if (!u) return; if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { new URL(u); } catch { toast.error('Endereço inválido.'); return; }
    const { error } = await db.from('task_links').insert({ task_id: taskId, url: u, title: title.trim() || null });
    if (error) { toast.error('Não foi possível adicionar o link.'); return; }
    setUrl(''); setTitle(''); setAdding(false); void load();
  };
  const remove = async (l: L) => { const { error } = await db.from('task_links').delete().eq('id', l.id); if (error) toast.error('Não foi possível remover.'); else void load(); };
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-sm font-medium"><LinkIcon className="h-4 w-4 text-muted-foreground" />Links e arquivos externos
        {!readOnly && !adding ? <button type="button" className="ml-auto inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-xs font-normal hover:bg-muted" onClick={() => setAdding(true)}><Plus className="h-3 w-3" />Adicionar</button> : null}</div>
      {list.length ? <div className="space-y-1">{list.map((l) => { const k = linkKind(l.url); return (
        <div key={l.id} className="group flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
          <span className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold text-white" style={{ background: k.color }}>{k.name}</span>
          <a href={l.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate hover:underline" title={l.url}>{l.title || l.url.replace(/^https?:\/\//, '')}</a>
          <a href={l.url} target="_blank" rel="noreferrer noopener" aria-label="Abrir"><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></a>
          {!readOnly ? <button type="button" className="opacity-0 group-hover:opacity-100" onClick={() => void remove(l)} aria-label="Remover link"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button> : null}
        </div>); })}</div> : !adding ? <p className="text-xs text-muted-foreground">Cole links do Google Drive, OneDrive, Dropbox, Figma, Notion e outros.</p> : null}
      {adding ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole o link (https://…)" className="h-8 min-w-0 flex-1 text-sm" autoFocus onKeyDown={(e) => e.key === 'Enter' && void add()} aria-label="Link" />
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome (opcional)" maxLength={120} className="h-8 w-40 text-sm" aria-label="Nome do link" />
          <Button size="sm" onClick={() => void add()}>Adicionar</Button><Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
        </div>) : null}
    </div>
  );
}
