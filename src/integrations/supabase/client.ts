import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const SUPABASE_URL = "https://scslfueixmuolkmgdslk.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BliZc1EBDW4h3U3eL-4qYQ_b9ivGYkV";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    // After a drop, every channel rejoins at once; slow and randomize the retries so the server's per-socket join limit is not hit.
    reconnectAfterMs: (tries: number) => Math.min(1000 * 2 ** Math.min(tries, 5), 30000) + Math.floor(Math.random() * 1500),
    params: { eventsPerSecond: 20 },
  },
});

// The app opens ~20 realtime channels as soon as someone signs in. The server limits joins per socket
// ("SocketJoinRateLimitReached") and the subscription pool times out ("Too many database timeouts"), so channels
// are joined one at a time, a few tenths of a second apart, instead of all in the same instant.
const JOIN_GAP_MS = 180;
let joinQueue: Array<() => void> = [];
let joinTimer: ReturnType<typeof setTimeout> | null = null;
function pumpJoins() {
  if (joinTimer) return;
  const next = joinQueue.shift();
  if (!next) return;
  next();
  joinTimer = setTimeout(() => { joinTimer = null; pumpJoins(); }, JOIN_GAP_MS);
}
try {
  const rawChannel = supabase.channel.bind(supabase);
  (supabase as unknown as { channel: typeof supabase.channel }).channel = ((name: string, opts?: Parameters<typeof supabase.channel>[1]) => {
    const ch = rawChannel(name, opts);
    const rawSubscribe = ch.subscribe.bind(ch);
    const rawUnsubscribe = ch.unsubscribe.bind(ch);
    let cancelled = false;
    ch.unsubscribe = ((t?: number) => { cancelled = true; return rawUnsubscribe(t); }) as typeof ch.unsubscribe;
    ch.subscribe = ((cb?: Parameters<typeof rawSubscribe>[0], timeout?: number) => {
      joinQueue.push(() => { if (!cancelled) rawSubscribe(cb, timeout); });
      pumpJoins();
      return ch;
    }) as typeof ch.subscribe;
    return ch;
  }) as typeof supabase.channel;
} catch { /* keep the plain client */ }