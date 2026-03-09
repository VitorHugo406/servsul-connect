-- Update the DELETE policy for war_rooms to allow admins, supervisors, and users with can_create_war_room permission

DROP POLICY IF EXISTS "Admins can delete war rooms" ON public.war_rooms;

CREATE POLICY "Permitted users can delete closed war rooms"
ON public.war_rooms
FOR DELETE
USING (
  status = 'closed' AND (
    is_admin() OR
    has_autonomy_level('supervisor') OR
    (EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
        AND (user_permissions.can_access_management = true OR user_permissions.can_create_war_room = true)
    ))
  )
);

-- Also allow deleting associated data when war room is deleted (cascading handled by FK, but let's ensure RLS allows it)

-- war_room_members: Add DELETE policy for permitted users
DROP POLICY IF EXISTS "Permitted users can delete war room members" ON public.war_room_members;
CREATE POLICY "Permitted users can delete war room members"
ON public.war_room_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM war_rooms wr
    WHERE wr.id = war_room_members.war_room_id
      AND wr.status = 'closed'
      AND (
        is_admin() OR
        has_autonomy_level('supervisor') OR
        (EXISTS (
          SELECT 1 FROM user_permissions
          WHERE user_permissions.user_id = auth.uid()
            AND (user_permissions.can_access_management = true OR user_permissions.can_create_war_room = true)
        ))
      )
  )
);

-- war_room_messages: Update DELETE policy  
DROP POLICY IF EXISTS "War room creator can delete messages" ON public.war_room_messages;
CREATE POLICY "Permitted users can delete war room messages"
ON public.war_room_messages
FOR DELETE
USING (
  (EXISTS (
    SELECT 1 FROM war_rooms
    WHERE war_rooms.id = war_room_messages.war_room_id
      AND war_rooms.created_by = auth.uid()
  )) OR
  is_admin() OR
  has_autonomy_level('supervisor') OR
  (EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_permissions.user_id = auth.uid()
      AND (user_permissions.can_access_management = true OR user_permissions.can_create_war_room = true)
  ))
);

-- war_room_timeline: Add DELETE policy
DROP POLICY IF EXISTS "Permitted users can delete timeline entries" ON public.war_room_timeline;
CREATE POLICY "Permitted users can delete timeline entries"
ON public.war_room_timeline
FOR DELETE
USING (
  is_admin() OR
  has_autonomy_level('supervisor') OR
  (EXISTS (
    SELECT 1 FROM war_rooms
    WHERE war_rooms.id = war_room_timeline.war_room_id
      AND war_rooms.created_by = auth.uid()
  )) OR
  (EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_permissions.user_id = auth.uid()
      AND (user_permissions.can_access_management = true OR user_permissions.can_create_war_room = true)
  ))
);