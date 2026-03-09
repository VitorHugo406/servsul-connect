-- Allow War Room members to view/update subtasks (only for the linked task while War Room is active)

-- task_subtasks: SELECT
DROP POLICY IF EXISTS "War room members can view linked subtasks" ON public.task_subtasks;
CREATE POLICY "War room members can view linked subtasks"
ON public.task_subtasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.war_rooms wr
    JOIN public.war_room_members wrm ON wrm.war_room_id = wr.id
    WHERE wr.task_id = public.task_subtasks.task_id
      AND wrm.user_id = auth.uid()
      AND wr.status = 'active'
  )
);

-- task_subtasks: UPDATE (toggle completion)
DROP POLICY IF EXISTS "War room members can update linked subtasks" ON public.task_subtasks;
CREATE POLICY "War room members can update linked subtasks"
ON public.task_subtasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.war_rooms wr
    JOIN public.war_room_members wrm ON wrm.war_room_id = wr.id
    WHERE wr.task_id = public.task_subtasks.task_id
      AND wrm.user_id = auth.uid()
      AND wr.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.war_rooms wr
    JOIN public.war_room_members wrm ON wrm.war_room_id = wr.id
    WHERE wr.task_id = public.task_subtasks.task_id
      AND wrm.user_id = auth.uid()
      AND wr.status = 'active'
  )
);

-- subtask_groups: SELECT (so grouped checklists render correctly)
DROP POLICY IF EXISTS "War room members can view linked subtask groups" ON public.subtask_groups;
CREATE POLICY "War room members can view linked subtask groups"
ON public.subtask_groups
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.war_rooms wr
    JOIN public.war_room_members wrm ON wrm.war_room_id = wr.id
    WHERE wr.task_id = public.subtask_groups.task_id
      AND wrm.user_id = auth.uid()
      AND wr.status = 'active'
  )
);
