-- Fix War Room chat persistence for supervisors/admins/authorized users
-- Root cause addressed: users with permission could see the room but not SELECT/INSERT messages unless explicitly a member.

-- Recreate SELECT policy
DROP POLICY IF EXISTS "Members can view war room messages" ON public.war_room_messages;
DROP POLICY IF EXISTS "Users can view war room messages" ON public.war_room_messages;

CREATE POLICY "Users can view war room messages"
ON public.war_room_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.war_room_members m
    WHERE m.war_room_id = war_room_messages.war_room_id
      AND m.user_id = auth.uid()
  )
  OR public.has_autonomy_level('supervisor')
  OR public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.user_permissions up
    WHERE up.user_id = auth.uid()
      AND (up.can_access_management = true OR up.can_create_war_room = true)
  )
);

-- Recreate INSERT policy
DROP POLICY IF EXISTS "Members can send war room messages" ON public.war_room_messages;
DROP POLICY IF EXISTS "Users can send war room messages" ON public.war_room_messages;

CREATE POLICY "Users can send war room messages"
ON public.war_room_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = public.get_current_profile_id()
  AND (
    EXISTS (
      SELECT 1
      FROM public.war_room_members m
      WHERE m.war_room_id = war_room_messages.war_room_id
        AND m.user_id = auth.uid()
    )
    OR public.has_autonomy_level('supervisor')
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND (up.can_access_management = true OR up.can_create_war_room = true)
    )
  )
);