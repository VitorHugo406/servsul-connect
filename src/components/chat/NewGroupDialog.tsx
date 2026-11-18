// Desktop "Novo grupo": name, optional description and the colleagues to add. The creator becomes the group admin
// (createGroup), then the chosen people are inserted as members (RLS: only the group admin may add them).
import { useMemo, useState } from 'react';
import { Check, Loader2, Search, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { usePrivateGroups } from '@/hooks/usePrivateGroups';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { ChatSenderAvatar } from '@/components/chat/ChatSenderIdentity';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (groupId: string) => void }

export function NewGroupDialog({ open, onOpenChange, onCreated }: Props) {
  const { createGroup } = usePrivateGroups();
  const { users } = useActiveUsers();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => users.filter((u) => (u.display_name || u.name || '').toLowerCase().includes(q.toLowerCase())), [users, q]);
  const reset = () => { setName(''); setDesc(''); setQ(''); setSel(new Set()); };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const create = async () => {
    if (!name.trim()) { toast.error('Digite o nome do grupo'); return; }
    setBusy(true);
    const { data, error } = await createGroup(name.trim().slice(0, 80), desc.trim() || undefined);
    if (error || !data?.id) { setBusy(false); toast.error('Não foi possível criar o grupo'); return; }
    const rows = users.filter((u) => sel.has(u.id)).map((u) => ({ group_id: data.id, user_id: u.user_id, profile_id: u.id, role: 'member' }));
    if (rows.length) {
      const { error: me } = await supabase.from('private_group_members').insert(rows);
      if (me) toast.error('Grupo criado, mas alguns participantes não foram adicionados. Adicione pelo menu do grupo.');
    }
    setBusy(false);
    toast.success('Grupo criado');
    reset(); onOpenChange(false); onCreated(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" />Novo grupo</DialogTitle>
          <DialogDescription>Dê um nome ao grupo e escolha quem participa. Você será o administrador.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do grupo" maxLength={80} autoFocus aria-label="Nome do grupo" />
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição (opcional)" rows={2} maxLength={300} aria-label="Descrição" />
          <div className="flex items-center justify-between text-sm"><span className="font-medium">Participantes</span><span className="text-muted-foreground">{sel.size} selecionado(s)</span></div>
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar colaborador" className="pl-9" aria-label="Buscar colaborador" /></div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            {list.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">Ninguém encontrado</p> : list.map((u) => {
              const on = sel.has(u.id); const title = u.display_name || u.name;
              return (
                <button key={u.id} type="button" onClick={() => toggle(u.id)} aria-pressed={on} className="flex w-full items-center gap-3 border-b border-border/60 px-3 py-2 text-left last:border-0 hover:bg-muted/60">
                  <ChatSenderAvatar name={title} avatarUrl={u.avatar_url} />
                  <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{on ? <Check className="h-3.5 w-3.5" /> : null}</span>
                </button>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={create} disabled={busy || !name.trim()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Criar grupo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
