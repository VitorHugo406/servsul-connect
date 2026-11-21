// Checks once per session whether a newer table exists in the database (e.g. task_trash, task_approvals from
// migration 20261120010000), so screens can hide features whose migration is not applied yet instead of
// promising something the server cannot do. Unknown = false until the check finishes.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const cache = new Map<string, Promise<boolean>>();
export function dbHasTable(table: string): Promise<boolean> {
  let p = cache.get(table);
  if (!p) {
    p = (supabase as any).from(table).select('*', { count: 'exact', head: true }).limit(1)
      .then(({ error }: { error: { code?: string; message?: string } | null }) => !error || !/42P01|does not exist|schema cache|PGRST205/i.test(`${error.code} ${error.message}`))
      .catch(() => false);
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
    p = (supabase as any).from(table).select(column, { count: 'exact', head: true }).limit(1)
      .then(({ error }: { error: { code?: string; message?: string } | null }) => !error || !/42703|42P01|does not exist|schema cache|PGRST20[45]/i.test(`${error.code} ${error.message}`))
      .catch(() => false);
    cache.set(k, p!);
  }
  return p!;
}
export function useDbColumn(table: string, column: string) {
  const [ok, setOk] = useState(false);
  useEffect(() => { let alive = true; void dbHasColumn(table, column).then((v) => { if (alive) setOk(v); }); return () => { alive = false; }; }, [table, column]);
  return ok;
}
