import { useEffect, useState } from 'react';
import { UserProfileViewDialog } from './UserProfileViewDialog';

export function UserProfileAvatarManager() {
  const [selected, setSelected] = useState<{
    userId: string | null;
    displayName: string;
    avatarUrl: string | null;
  } | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;

      // Never handle clicks while a modal/card preview owns the screen.
      if (document.body.classList.contains('card-preview-open')) return;

      const avatarHost = target.closest('[data-profile-avatar]') as HTMLElement | null;
      if (!avatarHost) return;

      const message = avatarHost.closest('.mobile-chat-message');
      if (!message) return;

      const userId = avatarHost.dataset.userId || null;
      const displayName = avatarHost.dataset.displayName || 'Usuário';
      const avatarUrl = avatarHost.dataset.avatarUrl || null;

      event.preventDefault();
      event.stopPropagation();
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
      onOpenChange={(open) => {
        if (!open) setSelected(null);
      }}
    />
  );
}
