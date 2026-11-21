// Client side of the EwvonAI user routes (supabase/functions/ewvon-ai): summaries and cards from text. The function
// reads the data with the person's own token (row-level security), uses the company's Claude key and the daily limit;
// errors come back as { error } with a Portuguese message, so screens can show them as they are.
import { supabase } from '@/integrations/supabase/client';
import { formatText } from '@/lib/chatFormatUtils';
import { createElement, Fragment, type ReactNode } from 'react';

export type AiCard = { title: string; description: string; priority: 'low' | 'medium' | 'high' | 'urgent'; due_date: string | null; assignee: string | null; column: string | null; subtasks: string[] };

async function call<T>(route: 'summarize_chat' | 'summarize_board' | 'cards_from_text', body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(`ewvon-ai/${route}`, { body });
  if (error) throw new Error('Não foi possível usar a IA agora. Confira a conexão e tente novamente.');
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export const aiSummarizeChat = (kind: 'sector' | 'group' | 'dm', id: string, hours: number) => call<{ text: string; count: number }>('summarize_chat', { kind, id, hours });
export const aiSummarizeBoard = (boardId: string) => call<{ text: string }>('summarize_board', { board_id: boardId });
export const aiCardsFromText = (boardId: string, text: string) => call<{ cards: AiCard[] }>('cards_from_text', { board_id: boardId, text });

/** Renders the AI's plain text (*bold*, "- " lists) with the chat formatter. */
export function renderAiText(text: string): ReactNode {
  return createElement(Fragment, null, ...text.split('\n').filter((l, i, a) => l.trim() || (i > 0 && a[i - 1].trim())).map((line, i) => {
    const li = /^\s*[-•]\s+/.test(line);
    const body = li ? line.replace(/^\s*[-•]\s+/, '') : line;
    return createElement('p', { key: i, className: li ? 'cx-li' : undefined }, body.trim() ? formatText(body, false) : ' ');
  }));
}
