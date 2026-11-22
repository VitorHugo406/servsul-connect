// Checks once per session whether a newer table exists in the database (e.g. task_trash, task_approvals from
// migration 20261120010000), so screens can hide features whose migration is not applied yet instead of
// promising something the server cannot do. Unknown = false until the check finishes.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const cache = new Map<string, Promise<boolean>>();
export function dbHasTable(table: string): Promise<boolean> {
  let p = cache.get(table);
  if (!p) {
    // GET with limit 0 (not HEAD: a HEAD answer has no body, so a missing table looked like "no error code" and the
    // feature showed up before its migration). Any error = not available; network failures are not cached.
    p = (supabase as any).from(table).select('*').limit(0)
      .then(({ error }: { error: { code?: string; message?: string } | null }) => { if (error && (!error.code || error.code === '42501')) cache.delete(table); return !error; })
      .catch(() => { cache.delete(table); return false; });
    cache.set(table, p!);
  }
  return p!;
}
export function useDbFeature(table: string) {
  const [ok, setOk] = useState(false);
  useEffect(() => { let alive = true; void dbHasTable(table).then((v) => { if (alive) setOk(v); }); return () => { alive = false; }; }, [table]);
  return ok;
}

/** Same idea for a column added by a pending migration (e.g. announcements.require_ack). */
export function dbHasColumn(table: string, column: string): Promise<boolean> {
  const k = `${table}.${column}`;
  let p = cache.get(k);
  if (!p) {
    p = (supabase as any).from(table).select(column).limit(0)
      .then(({ error }: { error: { code?: string; message?: string } | null }) => { if (error && (!error.code || error.code === '42501')) cache.delete(k); return !error; })
      .catch(() => { cache.delete(k); return false; });
    cache.set(k, p!);
  }
  return p!;
}
export function useDbColumn(table: string, column: string) {
  const [ok, setOk] = useState(false);
  useEffect(() => { let alive = true; void dbHasColumn(table, column).then((v) => { if (alive) setOk(v); }); return () => { alive = false; }; }, [table, column]);
  return ok;
}
