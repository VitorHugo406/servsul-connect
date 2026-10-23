-- Prevent war-room timeline writes against rooms outside the caller's tenant.
DROP POLICY IF EXISTS "Only room creator can add timeline entries" ON public.war_room_timeline;
CREATE POLICY "Only room creator can add timeline entries"
ON public.war_room_timeline
FOR INSERT TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.war_rooms wr
    WHERE wr.id = public.war_room_timeline.war_room_id
      AND wr.created_by = (SELECT auth.uid())
      AND public.same_company(wr.company_id)
  )
);

-- A board member must belong to the same company as the board, including on inserts/role changes.
DROP POLICY IF EXISTS "Board owners can manage members" ON public.task_board_members;
CREATE POLICY "Board owners can manage members"
ON public.task_board_members
FOR ALL TO authenticated
USING (public.is_board_owner(board_id))
WITH CHECK (
  public.is_board_owner(board_id)
  AND EXISTS (
    SELECT 1
    FROM public.task_boards b
    JOIN public.profiles p ON p.user_id = public.task_board_members.user_id
    WHERE b.id = public.task_board_members.board_id
      AND b.company_id = public.current_company_id()
      AND p.company_id = b.company_id
      AND p.is_active = true
  )
);

DROP POLICY IF EXISTS "Board owners and admins can update members" ON public.task_board_members;
CREATE POLICY "Board owners and admins can update members"
ON public.task_board_members
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.task_boards b
    WHERE b.id = public.task_board_members.board_id
      AND b.company_id = public.current_company_id()
      AND (
        b.owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.task_board_members actor
          WHERE actor.board_id = b.id
            AND actor.user_id = (SELECT auth.uid())
            AND actor.role = 'admin'
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.task_boards b
    JOIN public.profiles p ON p.user_id = public.task_board_members.user_id
    WHERE b.id = public.task_board_members.board_id
      AND b.company_id = public.current_company_id()
      AND p.company_id = b.company_id
      AND p.is_active = true
      AND (
        b.owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.task_board_members actor
          WHERE actor.board_id = b.id
            AND actor.user_id = (SELECT auth.uid())
            AND actor.role = 'admin'
        )
      )
  )
);

-- A member may only acknowledge their own existing membership, not move it to another room/user.
DROP POLICY IF EXISTS "Members can acknowledge" ON public.war_room_members;
CREATE POLICY "Members can acknowledge"
ON public.war_room_members
FOR UPDATE TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.war_rooms wr
    WHERE wr.id = public.war_room_members.war_room_id
      AND public.same_company(wr.company_id)
  )
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.war_rooms wr
    WHERE wr.id = public.war_room_members.war_room_id
      AND public.same_company(wr.company_id)
  )
);

-- Keep presence limited to active profiles in their own tenant.
DROP POLICY IF EXISTS "Users can insert their own presence" ON public.user_presence;
CREATE POLICY "Users can insert their own presence"
ON public.user_presence
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.is_active = true
      AND public.same_company(p.company_id)
  )
);

DROP POLICY IF EXISTS "Users can update their own presence" ON public.user_presence;
CREATE POLICY "Users can update their own presence"
ON public.user_presence
FOR UPDATE TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.is_active = true
      AND public.same_company(p.company_id)
  )
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.is_active = true
      AND public.same_company(p.company_id)
  )
);
