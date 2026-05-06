import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNoteShares } from '@/hooks/useNotes';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  noteId: string | null;
}

interface UserOption {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

export function NoteShareDialog({ open, onOpenChange, noteId }: ShareDialogProps) {
  const { shares, addShare, updateShare, removeShare } = useNoteShares(noteId);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [permission, setPermission] = useState<'read' | 'edit'>('read');

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, name, email, avatar_url')
        .eq('is_active', true)
        .order('name');
      setUsers((data || []) as UserOption[]);
    })();
  }, [open]);

  const filtered = users.filter((u) => {
    if (shares.some((s) => s.shared_with_user_id === u.user_id)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar anotação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Pessoas com acesso</p>
            {shares.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não compartilhada</p>
            ) : (
              <ScrollArea className="max-h-40">
                <div className="space-y-2">
                  {shares.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={s.profile?.avatar_url || ''} />
                        <AvatarFallback>{s.profile?.name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{s.profile?.name || 'Usuário'}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.profile?.email}</p>
                      </div>
                      <Select value={s.permission} onValueChange={(v) => updateShare(s.id, v as 'read' | 'edit')}>
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="read">Ler</SelectItem>
                          <SelectItem value="edit">Editar</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeShare(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Adicionar pessoa</p>
            <div className="flex gap-2 mb-2">
              <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={permission} onValueChange={(v) => setPermission(v as 'read' | 'edit')}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Ler</SelectItem>
                  <SelectItem value="edit">Editar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="h-72 rounded-md border border-border">
              <div className="space-y-1 p-1">
                {filtered.map((u) => (
                  <button
                    key={u.user_id}
                    className="flex w-full items-center gap-2 rounded p-2 text-left hover:bg-accent"
                    onClick={() => addShare(u.user_id, permission)}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={u.avatar_url || ''} />
                      <AvatarFallback>{u.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm">{u.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground text-center">Nenhum usuário encontrado</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
