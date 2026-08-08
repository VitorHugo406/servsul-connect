-- 1. Remove super_admin cross-company bypass on boards
CREATE OR REPLACE FUNCTION public.is_board_member(check_board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_boards b
    WHERE b.id = check_board_id
      AND b.company_id = public.current_company_id()
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.task_board_members m WHERE m.board_id = b.id AND m.user_id = auth.uid())
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_board_admin_or_owner(check_board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_boards b
    WHERE b.id = check_board_id
      AND b.company_id = public.current_company_id()
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.task_board_members m WHERE m.board_id = b.id AND m.user_id = auth.uid() AND m.role = 'admin')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_board_owner(check_board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_boards b
    WHERE b.id = check_board_id AND b.owner_id = auth.uid()
      AND b.company_id = public.current_company_id()
  );
$$;

DROP POLICY IF EXISTS "Board members and owners can view boards" ON public.task_boards;
CREATE POLICY "Board members and owners can view boards" ON public.task_boards
FOR SELECT TO authenticated
USING (same_company(company_id) AND (owner_id = auth.uid() OR is_board_member(id) OR is_admin()));

DROP POLICY IF EXISTS "Board members can view board tasks" ON public.tasks;
CREATE POLICY "Board members can view board tasks" ON public.tasks
FOR SELECT TO authenticated
USING (
  board_id IS NOT NULL
  AND same_company(company_id)
  AND EXISTS (SELECT 1 FROM public.task_boards b WHERE b.id = tasks.board_id AND b.company_id = tasks.company_id)
  AND is_board_member(board_id)
);

-- 2. Profiles listing must stay inside the company
CREATE OR REPLACE FUNCTION public.admin_list_profiles_full()
RETURNS SETOF profiles LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND can_access_management = true)
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles WHERE company_id = public.current_company_id() ORDER BY name;
END;
$$;

-- 3. Clean up cross-company board memberships
DELETE FROM public.task_board_members m
USING public.task_boards b, public.profiles p
WHERE m.board_id = b.id AND p.user_id = m.user_id AND p.company_id <> b.company_id;

-- 4. System-wide broadcasts (super admin only)
CREATE TABLE IF NOT EXISTS public.system_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_broadcasts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.system_broadcasts TO authenticated;
GRANT ALL ON public.system_broadcasts TO service_role;

ALTER TABLE public.system_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active users read active broadcasts" ON public.system_broadcasts
FOR SELECT TO authenticated
USING (check_user_is_active() AND is_active = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));

CREATE POLICY "Super admin reads all broadcasts" ON public.system_broadcasts
FOR SELECT TO authenticated USING (is_super_admin());

CREATE POLICY "Super admin creates broadcasts" ON public.system_broadcasts
FOR INSERT TO authenticated WITH CHECK (is_super_admin() AND created_by = auth.uid());

CREATE POLICY "Super admin updates broadcasts" ON public.system_broadcasts
FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "Super admin deletes broadcasts" ON public.system_broadcasts
FOR DELETE TO authenticated USING (is_super_admin());

CREATE TRIGGER update_system_broadcasts_updated_at
BEFORE UPDATE ON public.system_broadcasts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();