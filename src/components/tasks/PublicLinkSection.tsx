// "Link para convidados (somente leitura)" inside the board's Share dialog: create, copy, disable or recreate the public
// link (/m/<token>) that shows the mural to people outside the company without login.
import { useEffect, useState } from 'react';
import { Copy, Eye, Loader2, RefreshCw, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { appConfirm } from '@/lib/appDialog';

const db = supabase as any;
export function PublicLinkSection({ boardId, canManage }: { boardId: string; canManage: boolean }) {
  const [link, setLink] = useState<{ id: string; token: string; enabled: boolean; allow_comments?: boolean } | null>(null);
  const [busy, setBusy] = useState(true);
  const load = async () => {
    setBusy(true);
    const { data } = await db.from('board_public_links').select('id,token,enabled,allow_comments').eq('board_id', boardId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setLink(data || null); setBusy(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [boardId]);
  const url = link ? `${window.location.origin}/m/${link.token}` : '';
  const create = async () => {
    setBusy(true);
    if (link) await db.from('board_public_links').delete().eq('id', link.id);
    const { data, error } = await db.from('board_public_links').insert({ board_id: boardId }).select('id,token,enabled,allow_comments').single();
    setBusy(false);
    if (error) { toast.error('Só o dono ou administrador do mural pode criar o link.'); return; }
    setLink(data); toast.success('Link para convidados criado');
  };
  const toggle = async () => {
    if (!link) return;
    if (link.enabled && !(await appConfirm({ title: 'Desativar o link?', message: 'Quem tiver o link deixa de ver o mural na hora.', confirmText: 'Desativar', danger: true }))) return;
    const { error } = await db.from('board_public_links').update({ enabled: !link.enabled }).eq('id', link.id);
    if (error) { toast.error('Não foi possível alterar o link.'); return; }
    setLink({ ...link, enabled: !link.enabled });
  };
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 text-sm font-medium"><Eye className="h-4 w-4" />Link para convidados (somente leitura)</div>
      <p className="text-xs text-muted-foreground">Clientes ou fornecedores veem as colunas e os cards (título, prazo, etiquetas e progresso) sem login e sem ocupar vaga. Descrições, comentários internos, anexos e pessoas não aparecem.</p>
      {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : link ? (
        <>
          <div className="flex gap-2"><Input readOnly value={url} className={`font-mono text-xs ${link.enabled ? '' : 'opacity-50 line-through'}`} />
            <Button variant="outline" size="icon" disabled={!link.enabled} onClick={() => { void navigator.clipboard.writeText(url); toast.success('Link copiado'); }} aria-label="Copiar link"><Copy className="h-4 w-4" /></Button></div>
          {canManage ? <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={toggle}>{link.enabled ? <><EyeOff className="mr-1.5 h-4 w-4" />Desativar</> : <><Eye className="mr-1.5 h-4 w-4" />Reativar</>}</Button>
            <Button variant="outline" size="sm" onClick={create}><RefreshCw className="mr-1.5 h-4 w-4" />Gerar novo link</Button>
          </div> : null}
          {canManage ? <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={!!link.allow_comments} onChange={async (e) => { const v = e.target.checked; const { error } = await db.from('board_public_links').update({ allow_comments: v }).eq('id', link.id); if (error) { toast.error('Não foi possível alterar.'); return; } setLink({ ...link, allow_comments: v }); toast.success(v ? 'Convidados podem comentar e aprovar' : 'Comentários de convidados desligados'); }} />
            <span><b>Permitir que convidados comentem e aprovem cards.</b> O comentário aparece no link e também dentro do card, para a equipe.</span></label> : null}
        </>
      ) : canManage ? <Button variant="outline" className="w-full" onClick={create}><Eye className="mr-2 h-4 w-4" />Criar link para convidados</Button>
        : <p className="text-xs text-muted-foreground">Peça ao dono do mural para criar o link.</p>}
    </div>
  );
}
