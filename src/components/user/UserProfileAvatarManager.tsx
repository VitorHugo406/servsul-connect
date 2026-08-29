import { useEffect, useState } from 'react';
import { UserProfileViewDialog } from './UserProfileViewDialog';

export function UserProfileAvatarManager() {
  const [selected, setSelected] = useState<{ userId: string | null; displayName: string; avatarUrl: string | null } | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      const avatarContainer = target.closest('.mobile-chat-message > .relative.z-10');
      if (!avatarContainer) return;
      const message = avatarContainer.closest('.mobile-chat-message');
      const avatar = avatarContainer.querySelector('img[alt]') as HTMLImageElement | null;
      if (!message || !avatar) return;
      const displayName = avatar.alt || 'Usuário';
      const headerName = message.querySelector('span.text-xs.font-medium, span.sm\\:text-sm') as HTMLElement | null;
      const resolvedName = headerName?.textContent?.trim() || displayName;
      const avatarUrl = avatar.getAttribute('src') || null;
      event.preventDefault();
      event.stopPropagation();
      setSelected({ userId: null, displayName: resolvedName, avatarUrl });
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return <UserProfileViewDialog userId={selected?.userId} displayName={selected?.displayName} avatarUrl={selected?.avatarUrl} open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} />;
}
