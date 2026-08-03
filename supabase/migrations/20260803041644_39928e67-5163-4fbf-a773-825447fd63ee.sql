
-- Default company on insert
CREATE OR REPLACE FUNCTION public.set_company_id_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.current_company_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['war_rooms','tasks','task_boards','sectors','teams','notes','private_groups','calendar_events','announcements','messages','direct_messages'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_company_id_default ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_company_id_default BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default()', t);
  END LOOP;
END $$;

-- WAR ROOMS: company isolation
DROP POLICY IF EXISTS "Members creators and admins can view war rooms" ON public.war_rooms;
CREATE POLICY "Members creators and admins can view war rooms"
ON public.war_rooms FOR SELECT TO authenticated
USING (
  (public.same_company(company_id) OR public.is_super_admin())
  AND (
    public.is_admin() OR created_by = auth.uid() OR public.is_war_room_member(id)
    OR EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = auth.uid() AND (up.can_create_war_room OR up.can_access_management))
  )
);

DROP POLICY IF EXISTS "Creators and admins can update war rooms" ON public.war_rooms;
CREATE POLICY "Creators and admins can update war rooms"
ON public.war_rooms FOR UPDATE TO authenticated
USING (public.same_company(company_id) AND (created_by = auth.uid() OR public.is_admin()))
WITH CHECK (public.same_company(company_id));

DROP POLICY IF EXISTS "Permitted users can delete closed war rooms" ON public.war_rooms;
CREATE POLICY "Permitted users can delete closed war rooms"
ON public.war_rooms FOR DELETE TO authenticated
USING (
  public.same_company(company_id) AND status = 'closed'
  AND (public.is_admin() OR public.has_autonomy_level('supervisor')
    OR EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = auth.uid() AND (up.can_access_management OR up.can_create_war_room)))
);

DROP POLICY IF EXISTS "Permitted users can create war rooms" ON public.war_rooms;
CREATE POLICY "Permitted users can create war rooms"
ON public.war_rooms FOR INSERT TO authenticated
WITH CHECK (
  public.same_company(company_id)
  AND (public.is_admin() OR public.has_autonomy_level('supervisor')
    OR EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = auth.uid() AND (up.can_access_management OR up.can_create_war_room)))
);

-- WAR ROOM MEMBERS: only within same-company war rooms
DROP POLICY IF EXISTS "Members creators and admins can view war room members" ON public.war_room_members;
CREATE POLICY "Members creators and admins can view war room members"
ON public.war_room_members FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.war_rooms wr WHERE wr.id = war_room_members.war_room_id AND public.same_company(wr.company_id))
  AND (
    public.is_admin() OR user_id = auth.uid() OR public.is_war_room_member(war_room_id)
    OR EXISTS (SELECT 1 FROM public.war_rooms wr2 WHERE wr2.id = war_room_members.war_room_id AND wr2.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = auth.uid() AND (up.can_create_war_room OR up.can_access_management))
  )
);

-- PROFILES: admins limited to own company
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update profiles in their company"
ON public.profiles FOR UPDATE TO authenticated
USING (public.is_admin() AND (public.same_company(company_id) OR public.is_super_admin()))
WITH CHECK (public.is_admin() AND (public.same_company(company_id) OR public.is_super_admin()));

-- TASK BOARDS / TASKS: company isolation on read
DROP POLICY IF EXISTS "Board members and owners can view boards" ON public.task_boards;
CREATE POLICY "Board members and owners can view boards"
ON public.task_boards FOR SELECT TO authenticated
USING (
  (public.same_company(company_id) OR public.is_super_admin())
  AND (owner_id = auth.uid() OR public.is_board_member(id) OR public.is_admin())
);

DROP POLICY IF EXISTS "Board members can view board tasks" ON public.tasks;
CREATE POLICY "Board members can view board tasks"
ON public.tasks FOR SELECT TO authenticated
USING (
  (public.same_company(company_id) OR public.is_super_admin())
  AND board_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.task_boards b WHERE b.id = tasks.board_id)
);

-- Storage stats per company (super admin only)
CREATE OR REPLACE FUNCTION public.get_company_storage_stats()
RETURNS TABLE (company_id uuid, company_name text, table_name text, row_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  t text;
  n bigint;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  FOR c IN SELECT id, name FROM public.companies ORDER BY name LOOP
    FOREACH t IN ARRAY ARRAY['profiles','messages','direct_messages','announcements','tasks','task_boards','notes','sectors','private_groups','calendar_events','war_rooms'] LOOP
      EXECUTE format('SELECT count(*) FROM public.%I WHERE company_id = $1', t) INTO n USING c.id;
      company_id := c.id; company_name := c.name; table_name := t; row_count := n;
      RETURN NEXT;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_company_storage_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_company_storage_stats() TO authenticated;
