import { useEffect, useState } from 'react';
import { Calendar, Clock, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';

interface UserProfileViewDialogProps {
  userId?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PublicProfile {
  user_id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url?: string | null;
  work_period: string | null;
  birth_date: string | null;
  email: string | null;
}

const OPTIONAL_PROFILE_KEY = (userId: string) => `nuvexa:profile-extra:${userId}`;
const PROFILE_FIELDS = 'user_id,name,display_name,avatar_url,cover_url,work_period,birth_date,email';

export function UserProfileViewDialog({ userId, displayName, avatarUrl, open, onOpenChange }: UserProfileViewDialogProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      let data: any = null;

      if (userId) {
        const result = await supabase.from('profiles').select(PROFILE_FIELDS).eq('user_id', userId).maybeSingle();
        data = result.data;
      }
      if (!data && avatarUrl) {
        const result = await supabase.from('profiles').select(PROFILE_FIELDS).eq('avatar_url', avatarUrl).maybeSingle();
        data = result.data;
      }
      if (!data && displayName) {
        const byDisplay = await supabase.from('profiles').select(PROFILE_FIELDS).eq('display_name', displayName).maybeSingle();
        data = byDisplay.data;
        if (!data) {
          const byName = await supabase.from('profiles').select(PROFILE_FIELDS).eq('name', displayName).maybeSingle();
          data = byName.data;
        }
      }

      if (cancelled) return;
      if (data) {
        let extra: any = {};
        try { extra = JSON.parse(localStorage.getItem(OPTIONAL_PROFILE_KEY(data.user_id)) || '{}'); } catch {}
        setProfile({ ...data, cover_url: data.cover_url || extra.cover_url || null });
      } else {
        setProfile(null);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [open, userId, displayName, avatarUrl]);

  const shownName = profile?.display_name || profile?.name || displayName || 'Usuário';
  const initials = shownName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const formatDate = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : 'Não informado';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-2xl p-0">
        <div className="relative h-32 bg-muted">
          {profile?.cover_url && <img src={profile.cover_url} alt="Capa do perfil" className="h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <Avatar className="absolute -bottom-10 left-5 h-20 w-20 border-4 border-background shadow-lg">
            <AvatarImage src={profile?.avatar_url || avatarUrl || ''} alt={shownName} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xl">{initials}</AvatarFallback>
          </Avatar>
        </div>
        <div className="px-5 pb-5 pt-14">
          <DialogHeader className="text-left">
            <DialogTitle>{shownName}</DialogTitle>
            <DialogDescription>Informações do perfil</DialogDescription>
          </DialogHeader>
          {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Carregando perfil...</div> : (
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-border p-3"><Clock className="h-5 w-5 shrink-0 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Horário de trabalho</p><p className="text-sm font-medium">{profile?.work_period || 'Não informado'}</p></div></div>
              <div className="flex items-center gap-3 rounded-xl border border-border p-3"><Calendar className="h-5 w-5 shrink-0 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Data de aniversário</p><p className="text-sm font-medium">{formatDate(profile?.birth_date || null)}</p></div></div>
              <div className="flex items-center gap-3 rounded-xl border border-border p-3"><Mail className="h-5 w-5 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="text-xs text-muted-foreground">E-mail</p><p className="truncate text-sm font-medium">{profile?.email || 'Não informado'}</p></div></div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
