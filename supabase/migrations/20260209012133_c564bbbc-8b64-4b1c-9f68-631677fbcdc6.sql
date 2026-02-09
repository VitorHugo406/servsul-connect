
-- Fix 1: profiles - require authentication for SELECT
DROP POLICY IF EXISTS "Usuários autenticados podem ver todos os perfis" ON public.profiles;
CREATE POLICY "Usuários autenticados podem ver todos os perfis"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Fix 2: user_presence - require authentication for SELECT
DROP POLICY IF EXISTS "Everyone can view presence" ON public.user_presence;
CREATE POLICY "Authenticated users can view presence"
  ON public.user_presence FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Fix 3: user_presence - restrict INSERT/UPDATE to authenticated
DROP POLICY IF EXISTS "Users can insert their own presence" ON public.user_presence;
CREATE POLICY "Users can insert their own presence"
  ON public.user_presence FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own presence" ON public.user_presence;
CREATE POLICY "Users can update their own presence"
  ON public.user_presence FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Fix 4: tasks - require authentication for all policies currently using 'public'
DROP POLICY IF EXISTS "Board members can view board tasks" ON public.tasks;
CREATE POLICY "Board members can view board tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (board_id IS NOT NULL AND is_board_member(board_id));

DROP POLICY IF EXISTS "Users can view tasks in their sectors" ON public.tasks;
CREATE POLICY "Users can view tasks in their sectors"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    sector_id IS NULL OR
    sector_id = get_current_sector_id() OR
    sector_id = '00000000-0000-0000-0000-000000000001'::uuid OR
    EXISTS (
      SELECT 1 FROM user_additional_sectors
      WHERE user_additional_sectors.user_id = auth.uid()
        AND user_additional_sectors.sector_id = tasks.sector_id
    )
  );

DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
CREATE POLICY "Users can create tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = get_current_profile_id());

DROP POLICY IF EXISTS "Board members can create board tasks" ON public.tasks;
CREATE POLICY "Board members can create board tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (board_id IS NOT NULL AND is_board_member(board_id) AND created_by = get_current_profile_id());

DROP POLICY IF EXISTS "Task creators and admins can update tasks" ON public.tasks;
CREATE POLICY "Task creators and admins can update tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (is_admin() OR created_by = get_current_profile_id() OR assigned_to = get_current_profile_id());

DROP POLICY IF EXISTS "Board members can update board tasks" ON public.tasks;
CREATE POLICY "Board members can update board tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (board_id IS NOT NULL AND is_board_member(board_id));

DROP POLICY IF EXISTS "Task creators and admins can delete tasks" ON public.tasks;
CREATE POLICY "Task creators and admins can delete tasks"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (is_admin() OR created_by = get_current_profile_id());

DROP POLICY IF EXISTS "Board members can delete board tasks" ON public.tasks;
CREATE POLICY "Board members can delete board tasks"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (board_id IS NOT NULL AND is_board_member(board_id));
