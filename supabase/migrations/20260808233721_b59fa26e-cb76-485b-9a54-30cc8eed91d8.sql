DROP POLICY IF EXISTS "War room members can view linked task" ON public.tasks;
CREATE POLICY "War room members can view linked task"
ON public.tasks FOR SELECT TO authenticated
USING (
  public.same_company(company_id)
  AND EXISTS (
    SELECT 1 FROM public.war_rooms wr
    JOIN public.war_room_members wrm ON wrm.war_room_id = wr.id
    WHERE wr.task_id = tasks.id
      AND wrm.user_id = auth.uid()
      AND wr.status = 'active'
      AND wr.company_id = tasks.company_id
  )
);