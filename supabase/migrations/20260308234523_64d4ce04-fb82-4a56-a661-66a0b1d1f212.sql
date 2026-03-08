DROP POLICY IF EXISTS "Members can add timeline entries" ON public.war_room_timeline;

CREATE POLICY "Only room creator can add timeline entries"
ON public.war_room_timeline
FOR INSERT
WITH CHECK (
  is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.war_rooms wr
    WHERE wr.id = war_room_timeline.war_room_id
      AND wr.created_by = auth.uid()
  )
);