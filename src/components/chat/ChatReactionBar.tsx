// Reactions for direct and private-group messages on desktop, shared with the
// Ewwon mobile app through the chat_reactions table (same five quick emojis).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { withCompany } from '@/lib/companyScope';
import { cn } from '@/lib/utils';
import { reactedJustNow, reactionBurst } from '@/lib/reactionFx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChatEmojiGrid } from './ChatEmojiGrid';
import { REACTION_EMOJIS } from '@/lib/chatReactionEmojis';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏'];

interface Row { message_id: string; emoji: string; profile_id: string }

export function useChatReactions(kind: 'dm' | 'group', messageIds: string[], meId?: string) {
  const [rows, setRows] = useState<Row[]>([]);
  const ids = useMemo(() => messageIds.filter((id) => id && !id.startsWith('temp-')), [messageIds]);
  const key = ids.join(',');

  useEffect(() => {
    if (!ids.length) { setRows([]); return; }
    let alive = true;
    void sb.from('chat_reactions').select('message_id,emoji,profile_id').in('message_id', ids.slice(-200)).then(({ data }: { data: Row[] | null }) => { if (alive) setRows(data || []); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const ch = sb.channel(`chat-reactions-${kind}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions' }, (p: { eventType: string; new: Row; old: Row }) => {
        const r = p.eventType === 'DELETE' ? p.old : p.new;
        if (!r?.message_id) return;
        setRows((rs) => {
          const rest = rs.filter((x) => !(x.message_id === r.message_id && x.emoji === r.emoji && x.profile_id === r.profile_id));
          return p.eventType === 'DELETE' ? rest : [...rest, r];
        });
      })
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [kind]);

  const get = useCallback((messageId: string) => {
    const map = new Map<string, { emoji: string; count: number; mine: boolean }>();
    for (const r of rows) {
      if (r.message_id !== messageId) continue;
      const cur = map.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
      cur.count += 1;
      if (r.profile_id === meId) cur.mine = true;
      map.set(r.emoji, cur);
    }
    return [...map.values()];
  }, [rows, meId]);

  const toggle = useCallback(async (messageId: string, emoji: string) => {
    if (!meId || messageId.startsWith('temp-')) return;
    const mine = rows.some((r) => r.message_id === messageId && r.emoji === emoji && r.profile_id === meId);
    setRows((rs) => (mine ? rs.filter((r) => !(r.message_id === messageId && r.emoji === emoji && r.profile_id === meId)) : [...rs, { message_id: messageId, emoji, profile_id: meId }]));
    const res = mine
      ? await sb.from('chat_reactions').delete().eq('message_id', messageId).eq('profile_id', meId).eq('emoji', emoji)
      : await sb.from('chat_reactions').insert(withCompany({ chat_kind: kind, message_id: messageId, profile_id: meId, emoji }));
    if (res.error && res.error.code !== '23505') console.warn('reaction', res.error);
  }, [rows, meId, kind]);

  return { get, toggle };
}

/** Emojis whose chip just appeared because the user reacted here: they get the mobile "boom" for 700ms. */
export function useReactionBoom(emojis: string[]) {
  const prev = useRef<string[] | null>(null);
  const [boom, setBoom] = useState<string[]>([]);
  const key = emojis.join('|');
  useEffect(() => {
    const before = prev.current; prev.current = emojis;
    if (!before || !reactedJustNow()) return;
    const added = emojis.filter((e) => !before.includes(e));
    if (!added.length) return;
    setBoom(added);
    const t = window.setTimeout(() => setBoom([]), 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return boom;
}

type Chip = { emoji: string; count: number; mine: boolean };
/** Keeps a removed chip on screen for 180ms so it can shrink away (mobile has no exit, desktop adds a short one). */
function useLeaving(reactions: Chip[]) {
  const prev = useRef<Chip[]>(reactions);
  const [leaving, setLeaving] = useState<Chip[]>([]);
  const key = reactions.map((r) => r.emoji).join('|');
  useEffect(() => {
    const gone = prev.current.filter((p) => !reactions.some((r) => r.emoji === p.emoji));
    prev.current = reactions;
    if (!gone.length) return;
    setLeaving(gone);
    const t = window.setTimeout(() => setLeaving([]), 180);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return leaving.filter((l) => !reactions.some((r) => r.emoji === l.emoji));
}

export function ChatReactionBar({ reactions, isOwn, onToggle }: { reactions: { emoji: string; count: number; mine: boolean }[]; isOwn: boolean; onToggle: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const boom = useReactionBoom(reactions.map((r) => r.emoji));
  const leaving = useLeaving(reactions);
  const toggle = (emoji: string, origin: Element | null) => {
    if (!reactions.some((r) => r.emoji === emoji && r.mine)) reactionBurst(origin, emoji);
    onToggle(emoji);
  };
  return (
    <div className={cn('chat-reactions', isOwn && 'is-own')}>
      {reactions.map((r) => (
        <button key={r.emoji} type="button" className={cn('chat-reaction', r.mine && 'is-mine', boom.includes(r.emoji) && 'boom')} onClick={(e) => toggle(r.emoji, e.currentTarget)}>
          <span>{r.emoji}</span>{r.count > 1 ? <b>{r.count}</b> : null}
        </button>
      ))}
      {leaving.map((r) => <span key={`l-${r.emoji}`} className="chat-reaction is-leaving" aria-hidden="true"><span>{r.emoji}</span></span>)}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><button type="button" className="chat-reaction-add" aria-label="Reagir"><SmilePlus className="h-3.5 w-3.5" /></button></PopoverTrigger>
        <PopoverContent side="top" align={isOwn ? 'end' : 'start'} collisionPadding={12} avoidCollisions className="chat-emoji-popover chat-rx-popover z-[500] w-auto p-2">
          <ChatEmojiGrid emojis={REACTION_EMOJIS} label="Escolher reação" onSelect={(e, origin) => { toggle(e, origin ?? null); setOpen(false); }} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
