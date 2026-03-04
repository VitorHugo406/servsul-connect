import React, { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { useSectors } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface UserMentionPickerProps {
  query: string;
  onSelect: (user: { id: string; name: string; display_name: string | null }) => void;
  onClose: () => void;
}

export function UserMentionPicker({ query, onSelect, onClose }: UserMentionPickerProps) {
  const { users } = useActiveUsers();
  const { sectors } = useSectors();
  const { profile } = useAuth();

  const filtered = users.filter(u => {
    if (u.id === profile?.id) return false;
    const name = (u.display_name || u.name || '').toLowerCase();
    return name.includes(query.toLowerCase());
  }).slice(0, 8);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 z-50 bg-card border border-border rounded-xl shadow-lg max-h-[250px] overflow-hidden">
      <ScrollArea className="max-h-[250px]">
        <div className="p-1">
          {filtered.map((user) => {
            const sector = sectors.find(s => s.id === user.sector_id);
            const displayName = user.display_name || user.name;
            return (
              <button
                key={user.id}
                onClick={() => onSelect({ id: user.id, name: user.name, display_name: user.display_name })}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted transition-colors"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar_url || ''} />
                  <AvatarFallback
                    className="text-xs text-white"
                    style={{ backgroundColor: sector?.color || '#6366f1' }}
                  >
                    {(displayName || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate block">{displayName}</span>
                  {sector && <span className="text-xs text-muted-foreground">{sector.name}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
