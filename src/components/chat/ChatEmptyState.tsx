import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type Kind = 'select' | 'group' | 'empty';

/** Friendly empty state for the desktop chat: simple inline illustration in the company color, text and one call to action. */
export function ChatEmptyState({ kind, title, text, actionLabel, onAction, extra }: { kind: Kind; title: string; text: string; actionLabel?: string; onAction?: () => void; extra?: ReactNode }) {
  return <div className="chat-empty flex flex-col items-center justify-center px-6 py-12 text-center">
    <div className="chat-empty-art" aria-hidden="true">
      <svg viewBox="0 0 160 120" width="160" height="120" fill="none">
        <rect className="chat-empty-back" x="14" y="22" width="92" height="58" rx="16" />
        <path className="chat-empty-back" d="M34 80 L30 98 L52 80 Z" />
        <rect className="chat-empty-front" x="54" y="42" width="92" height="58" rx="16" />
        <path className="chat-empty-front" d="M126 100 L132 114 L108 100 Z" />
        {kind === 'group'
          ? <g className="chat-empty-ink"><circle cx="86" cy="64" r="6" /><circle cx="104" cy="64" r="6" /><circle cx="122" cy="64" r="6" /><path d="M78 86 q8 -12 16 0 M96 86 q8 -12 16 0 M114 86 q8 -12 16 0" strokeWidth="3" strokeLinecap="round" fill="none" /></g>
          : <g className="chat-empty-ink"><rect x="72" y="62" width="56" height="6" rx="3" /><rect x="72" y="76" width="36" height="6" rx="3" /></g>}
        <circle className="chat-empty-dot" cx="128" cy="28" r="6" />
        <circle className="chat-empty-dot2" cx="30" cy="50" r="4" />
      </svg>
    </div>
    <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{title}</h3>
    <p className="mt-1 max-w-[320px] text-sm text-muted-foreground">{text}</p>
    {actionLabel && onAction ? <Button type="button" onClick={onAction} className="mt-5 h-10 gap-2 rounded-full px-5">{actionLabel}</Button> : null}
    {extra}
  </div>;
}

/** Focuses the conversation search box on the left rail so "Nova conversa" starts somewhere useful. */
export const focusConversationSearch = () => document.querySelector<HTMLInputElement>('input[aria-label="Buscar conversas"]')?.focus();
