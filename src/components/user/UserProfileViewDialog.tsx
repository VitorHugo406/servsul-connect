import { useEffect, useState } from 'react';
import { Calendar, Clock, Mail, Phone, Building2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface UserProfileViewDialogProps { userId?: string | null; displayName?: string | null; avatarUrl?: string | null; open: boolean; onOpenChange: (open: boolean) => void; }
interface PublicProfile { id: string; user_id: string; name: string; display_name: string | null; avatar_url: string | null; cover_url: string | null; work_period: string | null; birth_date: string | null; email: string | null; phone: string | null; address: string | null; description: string | null; user_status: string | null; sector_id: string | null; autonomy_level: string | null; }
const OPTIONAL_PROFILE_KEY = (userId: string) => `nuvexa:profile-extra:${userId}`;
const BASE_FIELDS = 'id,user_id,name,display_name,avatar_url,cover_url,work_period,birth_date,email,phone,address,description,user_status,sector_id,autonomy_level';

export function UserProfileViewDialog({ userId, displayName, avatarUrl, open, onOpenChange }: UserProfileViewDialogProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [sectorName, setSectorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      setProfile(null);
      setSectorName(null);

      try {
        let data: any = null;
        let lastError: any = null;

        if (userId) {
          // Profile ids and auth user ids are different UUIDs. Resolve them
          // independently instead of relying on a compound OR query.
          const byProfileId = await supabase.from('profiles').select(BASE_FIELDS).eq('id', userId).maybeSingle();
          if (!byProfileId.error && byProfileId.data) data = byProfileId.data;
          else lastError = byProfileId.error;

          if (!data) {
            const byAuthId = await supabase.from('profiles').select(BASE_FIELDS).eq('user_id', userId).maybeSingle();
            if (!byAuthId.error && byAuthId.data) data = byAuthId.data;
            else lastError = byAuthId.error || lastError;
          }
        }

        if (!data && avatarUrl) {
          const cleanUrl = avatarUrl.split('?')[0];
          const byAvatar = await supabase.from('profiles').select(BASE_FIELDS).or(`avatar_url.eq.${avatarUrl},avatar_url.eq.${cleanUrl}`).limit(1).maybeSingle();
          if (!byAvatar.error && byAvatar.data) data = byAvatar.data;
          else lastError = byAvatar.error || lastError;
        }

        if (!data && displayName) {
          const byDisplay = await supabase.from('profiles').select(BASE_FIELDS).eq('display_name', displayName).limit(1).maybeSingle();
          if (!byDisplay.error && byDisplay.data) data = byDisplay.data;
          else lastError = byDisplay.error || lastError;
          if (!data) {
            const byName = await supabase.from('profiles').select(BASE_FIELDS).eq('name', displayName).limit(1).maybeSingle();
            if (!byName.error && byName.data) data = byName.data;
            else lastError = byName.error || lastError;
          }
        }

        if (cancelled) return;

        if (!data) {
          setLoadError(lastError?.message || 'Não foi possível carregar as informações deste usuário.');
          setLoading(false);
          return;
        }

        let coverUrl = data.cover_url || null;
        try {
          const extra = JSON.parse(localStorage.getItem(OPTIONAL_PROFILE_KEY(data.user_id)) || '{}');
          coverUrl = coverUrl || extra.cover_url || null;
        } catch {}

        if (data.sector_id) {
          const sector = await supabase.from('sectors').select('name').eq('id', data.sector_id).maybeSingle();
          if (!cancelled) setSectorName(sector.data?.name || null);
        }

        if (!cancelled) {
          setProfile({ ...data, cover_url: coverUrl });
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading profile preview:', error);
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o perfil.');
          setLoading(false);
        }
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [open, userId, displayName, avatarUrl]);

  const shownName = profile?.display_name || profile?.name || displayName || 'Usuário';
  const initials = shownName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const formatDate = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informado';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-2xl p-0">
        <div className="relative h-32 bg-muted">
          {profile?.cover_url && <img src={profile.cover_url} alt="Capa do perfil" className="h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <Avatar className="absolute -bottom-10 left-5 h-20 w-20 border-4 border-background shadow-lg"><AvatarImage src={profile?.avatar_url || avatarUrl || ''} alt={shownName} /><AvatarFallback className="bg-primary text-primary-foreground text-xl">{initials}</AvatarFallback></Avatar>
        </div>
        <div className="px-5 pb-5 pt-14">
          <DialogHeader className="text-left"><DialogTitle>{shownName}</DialogTitle><DialogDescription>Informações do perfil</DialogDescription></DialogHeader>
          {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Carregando perfil...</div> : loadError ? <div className="py-8 text-center text-sm text-muted-foreground">{loadError}</div> : profile && (
            <div className="mt-5 space-y-3">
              {sectorName && <div className="flex items-center gap-3 rounded-xl border border-border p-3"><Building2 className="h-5 w-5 shrink-0 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Setor</p><p className="text-sm font-medium">{sectorName}</p></div></div>}
              <div className="flex items-center gap-3 rounded-xl border border-border p-3"><Clock className="h-5 w-5 shrink-0 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Horário de trabalho</p><p className="text-sm font-medium">{profile.work_period || 'Não informado'}</p></div></div>
              <div className="flex items-center gap-3 rounded-xl border border-border p-3"><Calendar className="h-5 w-5 shrink-0 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Data de aniversário</p><p className="text-sm font-medium">{formatDate(profile.birth_date)}</p></div></div>
              <div className="flex items-center gap-3 rounded-xl border border-border p-3"><Mail className="h-5 w-5 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="text-xs text-muted-foreground">E-mail</p><p className="truncate text-sm font-medium">{profile.email || 'Não informado'}</p></div></div>
              {profile.phone && <div className="flex items-center gap-3 rounded-xl border border-border p-3"><Phone className="h-5 w-5 shrink-0 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Telefone</p><p className="text-sm font-medium">{profile.phone}</p></div></div>}
              {profile.description && <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Sobre</p><p className="mt-1 whitespace-pre-wrap text-sm">{profile.description}</p></div>}
              {profile.autonomy_level && <Badge variant="secondary">{profile.autonomy_level}</Badge>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
