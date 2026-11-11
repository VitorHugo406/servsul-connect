import { cn } from '@/lib/utils';

export type ChatRailView = 'all' | 'direct' | 'groups' | 'sectors' | 'calls' | 'favorites';

const IMG = '/ewwon/img/chat3d/';
const ITEMS: { id: ChatRailView; label: string; img: string; plate?: boolean }[] = [
  { id: 'all', label: 'Conversas', img: 'chats.png' },
  { id: 'calls', label: 'Chamadas', img: 'calls.png' },
  { id: 'direct', label: 'Individuais', img: 'individual.png', plate: true },
  { id: 'groups', label: 'Grupos', img: 'group.png', plate: true },
  { id: 'sectors', label: 'Setores', img: 'sector.png' },
];
const FOOTER: { id: ChatRailView; label: string; img: string; plate?: boolean } = { id: 'favorites', label: 'Favoritos', img: 'favorites.png' };

/** Left app rail of the desktop chat (Teams-style): 3D illustrations (Fluent Emoji 3D) + short labels, solid dark purple. */
export function ChatRail({ active, onSelect, badges }: { active: ChatRailView; onSelect: (v: ChatRailView) => void; badges?: Partial<Record<ChatRailView, number>> }) {
  return <nav className="chat-rail" aria-label="Seções do chat">
    {[...ITEMS, FOOTER].map((it) => {
      const n = badges?.[it.id] || 0;
      return <button key={it.id} type="button" className={cn('chat-rail-item', it.id === 'favorites' && 'is-footer')} aria-pressed={active === it.id} aria-label={n > 0 ? `${it.label}, ${n} não lidas` : it.label} onClick={() => onSelect(it.id)}>
        <span className={cn('chat-rail-mark', it.plate && 'has-plate')}><img className="chat-rail-img" src={`${IMG}${it.img}`} alt="" width={30} height={30} loading="eager" decoding="async" draggable={false} />{n > 0 ? <span className="chat-rail-badge" aria-hidden="true">{n > 99 ? '99+' : n}</span> : null}</span>
        <span className="chat-rail-label" aria-hidden="true">{it.label}</span>
      </button>;
    })}
  </nav>;
}
