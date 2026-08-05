-- 1) Restrict all public-role policies in public schema to authenticated
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 2) Company scoping inside board membership functions
CREATE OR REPLACE FUNCTION public.is_board_owner(check_board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_boards b
    WHERE b.id = check_board_id
      AND b.owner_id = auth.uid()
      AND (b.company_id = public.current_company_id() OR public.is_super_admin())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_board_member(check_board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_boards b
    WHERE b.id = check_board_id
      AND (b.company_id = public.current_company_id() OR public.is_super_admin())
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.task_board_members m
          WHERE m.board_id = b.id AND m.user_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_board_admin_or_owner(check_board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_boards b
    WHERE b.id = check_board_id
      AND (b.company_id = public.current_company_id() OR public.is_super_admin())
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.task_board_members m
          WHERE m.board_id = b.id AND m.user_id = auth.uid() AND m.role = 'admin'
        )
      )
  );
$$;

-- 3) Tasks SELECT policy: require board membership + board company match
DROP POLICY IF EXISTS "Board members can view board tasks" ON public.tasks;
CREATE POLICY "Board members can view board tasks"
ON public.tasks FOR SELECT TO authenticated
USING (
  board_id IS NOT NULL
  AND (same_company(company_id) OR is_super_admin())
  AND EXISTS (
    SELECT 1 FROM public.task_boards b
    WHERE b.id = tasks.board_id
      AND b.company_id = tasks.company_id
  )
  AND public.is_board_member(board_id)
);

-- 4) Company logos readable pre-login (branding on company selection screen)
DROP POLICY IF EXISTS "Public read company logos" ON storage.objects;
CREATE POLICY "Public read company logos"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'company-logos');
