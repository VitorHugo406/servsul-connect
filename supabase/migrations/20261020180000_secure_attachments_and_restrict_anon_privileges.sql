-- Keep attachment files private and restrict anonymous database capabilities.
UPDATE storage.buckets
SET public = false
WHERE id = 'attachments';

REVOKE ALL ON FUNCTION public.get_board_tasks_fast(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_board_tasks_fast(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_companies_with_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_companies_with_stats() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_company_users(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_company_users(uuid) TO authenticated, service_role;

-- RLS does not protect against TRUNCATE, so anon must not have this capability.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE TRUNCATE ON TABLE %I.%I FROM anon', t.schemaname, t.tablename);
  END LOOP;
END
$$;
