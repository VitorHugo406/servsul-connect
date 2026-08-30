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

      // Resolve the image that was actually clicked instead of assuming a
      // particular parent class. This survives small chat layout changes.
      const avatar = target.closest('img[alt]') as HTMLImageElement | null;
      if (!avatar || !message.contains(avatar)) return;

      const avatarUrl = avatar.currentSrc || avatar.src || avatar.getAttribute('src') || null;
      const displayName = avatar.alt?.trim() || 'Usuário';

      // The avatar click is intentionally handled here, but the message itself
      // keeps its normal click/reaction behavior when another element is used.
      event.preventDefault();
      event.stopPropagation();

      let userId: string | null = null;
      try {
        if (avatarUrl) {
          const cleanUrl = avatarUrl.split('?')[0];
          const { data } = await supabase
            .from('profiles')
            .select('user_id,avatar_url')
            .or(`avatar_url.eq.${avatarUrl},avatar_url.eq.${cleanUrl}`)
            .limit(1)
            .maybeSingle();
          userId = data?.user_id || null;
        }

        if (!userId) {
          const escaped = displayName.replace(/,/g, '\\,');
          const { data } = await supabase
            .from('profiles')
            .select('user_id,name,display_name')
            .or(`display_name.eq.${escaped},name.eq.${escaped}`)
            .limit(1)
            .maybeSingle();
          userId = data?.user_id || null;
        }
      } catch (error) {
        console.warn('Could not resolve clicked avatar profile:', error);
      }

      setSelected({ userId, displayName, avatarUrl });
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return (
    <UserProfileViewDialog
      userId={selected?.userId}
      displayName={selected?.displayName}
      avatarUrl={selected?.avatarUrl}
      open={Boolean(selected)}
      onOpenChange={(open) => { if (!open) setSelected(null); }}
    />
  );
}
