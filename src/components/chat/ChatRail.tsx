import { cn } from '@/lib/utils';
import { RailIcon } from './ChatRailIcons';

export type ChatRailView = 'all' | 'direct' | 'groups' | 'sectors' | 'calls' | 'favorites';

const ITEMS: { id: ChatRailView; label: string}[] = [
  { id: 'all', label: 'Conversas' },
  { id: 'calls', label: 'Chamadas' },
  { id: 'direct', label: 'Individuais' },
  { id: 'groups', label: 'Grupos' },
  { id: 'sectors', label: 'Setores' },
];
const FOOTER: { id: ChatRailView; label: string} = { id: 'favorites', label: 'Favoritos' };

/** Left app rail of the desktop chat (Teams-style): flat filled glyphs (Fluent System Icons) + short labels, solid dark purple. */
export function ChatRail({ active, onSelect, badges }: { active: ChatRailView; onSelect: (v: ChatRailView) => void; badges?: Partial<Record<ChatRailView, number>> }) {
  return <nav className="chat-rail" aria-label="Seções do chat">
    {[...ITEMS, FOOTER].map((it) => {
      const n = badges?.[it.id] || 0;
      return <button key={it.id} type="button" className={cn('chat-rail-item', it.id === 'favorites' && 'is-footer')} aria-pressed={active === it.id} aria-label={n > 0 ? `${it.label}, ${n} não lidas` : it.label} onClick={() => onSelect(it.id)}>
        <span className={'chat-rail-mark'}><RailIcon id={it.id} />{n > 0 ? <span className="chat-rail-badge" aria-hidden="true">{n > 99 ? '99+' : n}</span> : null}</span>
        <span className="chat-rail-label" aria-hidden="true">{it.label}</span>
      </button>;
    })}
  </nav>;
}
