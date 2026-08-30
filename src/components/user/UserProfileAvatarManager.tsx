import { useEffect, useState } from 'react';
import { UserProfileViewDialog } from './UserProfileViewDialog';
import { supabase } from '@/integrations/supabase/client';

export function UserProfileAvatarManager() {
  const [selected, setSelected] = useState<{
    userId: string | null;
    displayName: string;
    avatarUrl: string | null;
  } | null>(null);

  useEffect(() => {
    const handleClick = async (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target || document.body.classList.contains('card-preview-open')) return;

      const avatarHost = target.closest('[data-profile-avatar]') as HTMLElement | null;
      const message = avatarHost?.closest('.mobile-chat-message') || target.closest('.mobile-chat-message');
      if (!message) return;

      const avatar = avatarHost || (target.closest('img[alt]') as HTMLElement | null);
      if (!avatar || !message.contains(avatar)) return;

      const image = avatar.tagName === 'IMG' ? avatar as HTMLImageElement : avatar.querySelector('img[alt]') as HTMLImageElement | null;
      const userId = avatar.getAttribute('data-user-id') || avatarHost?.dataset.userId || null;
      const displayName = avatar.getAttribute('data-display-name') || avatarHost?.dataset.displayName || image?.alt?.trim() || 'Usuário';
      const avatarUrl = avatar.getAttribute('data-avatar-url') || avatarHost?.dataset.avatarUrl || image?.currentSrc || image?.src || null;

      event.preventDefault();
      event.stopPropagation();

      let resolvedUserId = userId;
      if (!resolvedUserId) {
        try {
          const cleanUrl = avatarUrl?.split('?')[0] || '';
          if (avatarUrl) {
            const { data } = await supabase
              .from('profiles')
              .select('id,user_id')
              .or(`avatar_url.eq.${avatarUrl},avatar_url.eq.${cleanUrl}`)
              .limit(1)
              .maybeSingle();
            resolvedUserId = data?.id || data?.user_id || null;
          }

          if (!resolvedUserId && displayName !== 'Usuário') {
            const { data } = await supabase
              .from('profiles')
              .select('id,user_id')
              .or(`display_name.eq.${displayName.replace(/,/g, '\\,')},name.eq.${displayName.replace(/,/g, '\\,')}`)
              .limit(1)
              .maybeSingle();
            resolvedUserId = data?.id || data?.user_id || null;
          }
        } catch (error) {
          console.warn('Could not resolve clicked avatar profile:', error);
        }
      }

      setSelected({ userId: resolvedUserId, displayName, avatarUrl });
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
      onOpenChange={(open) => {
        if (!open) setSelected(null);
      }}
    />
  );
}
