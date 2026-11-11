import type { ReactNode } from 'react';
import { MessageSquare, Phone, User, UsersRound, Hash } from 'lucide-react';
import { TabMark3D } from '@/components/common/TabMark3D';
import { cn } from '@/lib/utils';

export type ChatRailView = 'all' | 'direct' | 'groups' | 'sectors' | 'calls';

const ITEMS: { id: ChatRailView; label: string; icon: ReactNode }[] = [
  { id: 'all', label: 'Conversas', icon: <MessageSquare /> },
  { id: 'direct', label: 'Individuais', icon: <User /> },
  { id: 'groups', label: 'Grupos', icon: <UsersRound /> },
  { id: 'sectors', label: 'Setores', icon: <Hash /> },
  { id: 'calls', label: 'Chamadas', icon: <Phone /> },
];

/** Left app rail of the desktop chat (Teams-style): 3D marks + short labels, solid dark purple. */
export function ChatRail({ active, onSelect, badges }: { active: ChatRailView; onSelect: (v: ChatRailView) => void; badges: Partial<Record<ChatRailView, number>> }) {
  return <nav className="chat-rail" aria-label="Seções do chat">
    {ITEMS.map((it) => {
      const n = badges[it.id] || 0;
      return <button key={it.id} type="button" className="chat-rail-item" aria-pressed={active === it.id} aria-label={n > 0 ? `${it.label}, ${n} não lidas` : it.label} onClick={() => onSelect(it.id)}>
        <span className="chat-rail-mark"><TabMark3D icon={it.icon} />{n > 0 ? <span className="chat-rail-badge" aria-hidden="true">{n > 99 ? '99+' : n}</span> : null}</span>
        <span className="chat-rail-label">{it.label}</span>
      </button>;
    })}
  </nav>;
}
