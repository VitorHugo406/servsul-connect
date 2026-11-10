// Live call history for the call cards in chat (WhatsApp-like: ringing, ongoing, ended with duration, missed, declined).
// One shared Realtime subscription per tab; card ids are fetched in batches.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CallStatus = 'ringing' | 'ongoing' | 'ended' | 'missed' | 'declined';
export type CallInfo = { id: string; caller_id: string; conv: 'dm' | 'group' | 'sector'; target: string; audio: boolean; status: CallStatus; created_at: string; answered_at: string | null; ended_at: string | null; duration_sec: number | null };

const COLS = 'id, caller_id, conv, target, audio, status, created_at, answered_at, ended_at, duration_sec';
const RING_LIMIT_MS = 60_000;          // a call still "ringing" after this was not answered (caller closed the app)
const ONGOING_LIMIT_MS = 6 * 3600_000; // an "ongoing" row this old lost its last participant without a goodbye

const store = new Map<string, CallInfo | null>();   // null = no row (old call or offline demo)
const listeners = new Set<() => void>();
const queue = new Set<string>();
let timer: number | null = null;
let channel: ReturnType<typeof supabase.channel> | null = null;
const emit = () => listeners.forEach((f) => f());

function listen() {
  if (channel) return;
  try {
    channel = supabase.channel('ewvon-chat-calls')
      .on('postgres_changes' as never, { event: '*', schema: 'public', table: 'chat_calls' }, (p: { new?: CallInfo }) => {
        if (p?.new?.id) { store.set(p.new.id, p.new); emit(); }
      })
      .subscribe();
  } catch { /* demo mode or offline */ }
}

function flush() {
  timer = null;
  const ids = [...queue]; queue.clear();
  if (!ids.length) return;
  void (async () => {
    try {
      const { data, error } = await (supabase as any).from('chat_calls').select(COLS).in('id', ids);
      if (error) throw error;
      const got = new Map<string, CallInfo>(((data || []) as CallInfo[]).map((r) => [r.id, r]));
      ids.forEach((id) => { if (got.has(id) || !store.get(id)) store.set(id, got.get(id) ?? null); });
    } catch { ids.forEach((id) => store.set(id, null)); }
    emit();
  })();
}

/** Re-read one call now (after this tab changed it). */
export function refreshCall(id: string) { queue.add(id); if (timer == null) timer = window.setTimeout(flush, 30); }

export function useCallInfo(id: string): CallInfo | null | undefined {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    listeners.add(f); listen();
    if (!id) return () => { listeners.delete(f); };
    if (!store.has(id)) refreshCall(id);
    // A card can render a moment before its history row is readable: look once more instead of caching "no row".
    const retry = store.get(id) === null ? window.setTimeout(() => refreshCall(id), 1500) : null;
    return () => { listeners.delete(f); if (retry != null) window.clearTimeout(retry); };
  }, [id]);
  // Safety net next to Realtime: while a call is live, re-read it every few seconds so the card flips to "encerrada" without reloading.
  const cur = store.has(id) ? store.get(id) : undefined;
  const live = !!cur && (cur.status === 'ringing' || cur.status === 'ongoing');
  useEffect(() => {
    if (!id || !live) return;
    const t = window.setInterval(() => refreshCall(id), 3000);
    return () => window.clearInterval(t);
  }, [id, live]);
  return cur;
}

/** Status as people should see it, accounting for calls whose last participant vanished without hanging up. */
export function effectiveStatus(c: CallInfo, now = Date.now()): CallStatus {
  if (c.status === 'ringing' && now - Date.parse(c.created_at) > RING_LIMIT_MS) return 'missed';
  if (c.status === 'ongoing' && c.answered_at && now - Date.parse(c.answered_at) > ONGOING_LIMIT_MS) return 'ended';
  return c.status;
}

/** "menos de 1 min", "1 min", "12 min", "1 h 05 min". */
export function formatCallDuration(sec: number | null | undefined) {
  if (sec == null) return '';
  if (sec < 60) return 'menos de 1 min';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

// Server updates; failures are ignored so calls still work if the history is unavailable.
const rpc = async (fn: string, args: Record<string, unknown>) => { try { const { data, error } = await (supabase as any).rpc(fn, args); return error ? null : data; } catch { return null; } };
export const callCreate = (id: string, conv: string, target: string, audio: boolean) => rpc('call_create', { _id: id, _conv: conv, _target: target, _audio: audio }).then(() => refreshCall(id));
export const callAnswered = (id: string) => rpc('call_answered', { _id: id });
export const callEnd = (id: string, reason?: 'declined') => rpc('call_end', { _id: id, _reason: reason ?? null }).then((r) => { refreshCall(id); return r as { status: CallStatus; duration_sec: number | null } | null; });
