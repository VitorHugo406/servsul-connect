import { ReactNode } from 'react';
import { MessageCircle, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Kind = 'select' | 'group' | 'empty';

export const OPEN_LIST_SEARCH_EVENT = 'nuvexa:chat-open-list-search';

const initialsOf = (name?: string) => (name || '').replace(/^#/, '').split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();

/** Empty state for the desktop chat: big avatar (initials on a tint of the company color), bold title and a short gray text. */
export function ChatEmptyState({ kind, title, text, name, actionLabel, onAction, extra }: { kind: Kind; title: string; text: string; name?: string; actionLabel?: string; onAction?: () => void; extra?: ReactNode }) {
  const initials = initialsOf(name);
  return <div className="chat-empty flex flex-col items-center justify-center px-6 py-12 text-center">
    <div className="chat-empty-avatar" aria-hidden="true">
      {initials ? <span>{initials}</span> : kind === 'group' ? <UsersRound className="h-12 w-12" strokeWidth={1.5} /> : <MessageCircle className="h-12 w-12" strokeWidth={1.5} />}
    </div>
    <h3 className="chat-empty-title">{title}</h3>
    <p className="chat-empty-text">{text}</p>
    {actionLabel && onAction ? <Button type="button" onClick={onAction} className="mt-5 h-9 gap-2 px-5">{actionLabel}</Button> : null}
    {extra}
  </div>;
}

/** Opens (and focuses) the conversation search box on the left rail so "Nova conversa" starts somewhere useful. */
export const focusConversationSearch = () => window.dispatchEvent(new Event(OPEN_LIST_SEARCH_EVENT));
