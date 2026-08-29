import { useEffect, useState } from 'react';
import { UserProfileViewDialog } from './UserProfileViewDialog';
import { supabase } from '@/integrations/supabase/client';

export function UserProfileAvatarManager() {
  const [selected, setSelected] = useState<{ userId: string | null; displayName: string; avatarUrl: string | null } | null>(null);

  useEffect(() => {
    const handleClick = async (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      const message = target.closest('.mobile-chat-message');
      if (!message) return;

      // Only the avatar opens the profile; clicking the message bubble must keep
      // its existing chat/reaction behavior.
      const avatar = message.querySelector('.relative.z-10 img[alt]') as HTMLImageElement | null;
      if (!avatar || !avatar.contains(target) && !target.closest('.relative.z-10')) return;

      const displayName = avatar.alt || 'Usuário';
      const avatarUrl = avatar.getAttribute('src') || null;
      const headerName = message.querySelector('span.text-xs.font-medium, span.sm\\:text-sm') as HTMLElement | null;
      const resolvedName = headerName?.textContent?.trim() || displayName;

      event.preventDefault();
      event.stopPropagation();

      let userId: string | null = null;
      try {
        if (avatarUrl) {
          const { data } = await supabase.from('profiles').select('user_id').eq('avatar_url', avatarUrl).maybeSingle();
          userId = data?.user_id || null;
        }
        if (!userId) {
          const { data } = await supabase.from('profiles').select('user_id').or(`display_name.eq.${resolvedName},name.eq.${resolvedName}`).limit(1).maybeSingle();
          userId = data?.user_id || null;
        }
      } catch {
        // The profile dialog can still resolve the user from the display name/avatar.
      }

      setSelected({ userId, displayName: resolvedName, avatarUrl });
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return <UserProfileViewDialog userId={selected?.userId} displayName={selected?.displayName} avatarUrl={selected?.avatarUrl} open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} />;
}
