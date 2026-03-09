-- Drop and recreate the INSERT policy for war_room_messages with TO authenticated
DROP POLICY IF EXISTS "Members can send war room messages" ON public.war_room_messages;

CREATE POLICY "Members can send war room messages" 
ON public.war_room_messages
FOR INSERT 
TO authenticated
WITH CHECK (
  (
    (
      EXISTS (
        SELECT 1
        FROM war_room_members
        WHERE war_room_members.war_room_id = war_room_messages.war_room_id
        AND war_room_members.user_id = auth.uid()
      )
    ) OR is_admin()
  ) AND (sender_id = get_current_profile_id())
);