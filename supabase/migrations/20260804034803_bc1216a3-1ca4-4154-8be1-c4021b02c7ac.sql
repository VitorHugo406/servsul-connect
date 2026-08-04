-- Strict tenant isolation: super admins are not allowed to bypass ordinary people/chat visibility.
DROP POLICY IF EXISTS "Authenticated users can view profiles in their company" ON public.profiles;
CREATE POLICY "Users view profiles only in their company"
ON public.profiles FOR SELECT TO authenticated
USING (
  public.check_user_is_active()
  AND company_id = public.current_company_id()
);

DROP POLICY IF EXISTS "Admins can update profiles in their company" ON public.profiles;
CREATE POLICY "Admins update profiles only in their company"
ON public.profiles FOR UPDATE TO authenticated
USING (public.is_admin() AND company_id = public.current_company_id())
WITH CHECK (public.is_admin() AND company_id = public.current_company_id());

-- Normalize existing direct-message ownership from the sender and remove impossible cross-company rows.
DELETE FROM public.direct_messages dm
USING public.profiles sender, public.profiles receiver
WHERE sender.id = dm.sender_id
  AND receiver.id = dm.receiver_id
  AND sender.company_id <> receiver.company_id;

UPDATE public.direct_messages dm
SET company_id = sender.company_id
FROM public.profiles sender
WHERE sender.id = dm.sender_id
  AND dm.company_id IS DISTINCT FROM sender.company_id;

DROP POLICY IF EXISTS "Users can only view their own direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can send direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can update read status of their received messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can delete their own sent messages" ON public.direct_messages;

CREATE POLICY "Company participants view direct messages"
ON public.direct_messages FOR SELECT TO authenticated
USING (
  company_id = public.current_company_id()
  AND (sender_id = public.get_current_profile_id() OR receiver_id = public.get_current_profile_id())
);
CREATE POLICY "Company users send direct messages"
ON public.direct_messages FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.current_company_id()
  AND sender_id = public.get_current_profile_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles receiver
    WHERE receiver.id = receiver_id
      AND receiver.company_id = public.current_company_id()
      AND receiver.is_active = true
  )
);
CREATE POLICY "Recipients update direct message read state"
ON public.direct_messages FOR UPDATE TO authenticated
USING (company_id = public.current_company_id() AND receiver_id = public.get_current_profile_id())
WITH CHECK (company_id = public.current_company_id() AND receiver_id = public.get_current_profile_id());
CREATE POLICY "Senders delete own direct messages"
ON public.direct_messages FOR DELETE TO authenticated
USING (company_id = public.current_company_id() AND sender_id = public.get_current_profile_id());

-- Normalize group ownership and discard cross-company memberships before tightening policies.
UPDATE public.private_groups pg
SET company_id = p.company_id
FROM public.profiles p
WHERE p.user_id = pg.created_by
  AND pg.company_id IS DISTINCT FROM p.company_id;

DELETE FROM public.private_group_members pgm
USING public.private_groups pg, public.profiles p
WHERE pg.id = pgm.group_id
  AND p.id = pgm.profile_id
  AND p.company_id <> pg.company_id;

DROP POLICY IF EXISTS "Members can view their groups" ON public.private_groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.private_groups;
DROP POLICY IF EXISTS "Group admins can update their groups" ON public.private_groups;
DROP POLICY IF EXISTS "Group admins can delete their groups" ON public.private_groups;
CREATE POLICY "Company members view private groups"
ON public.private_groups FOR SELECT TO authenticated
USING (company_id = public.current_company_id() AND (public.user_is_member_of_group(id) OR created_by = auth.uid()));
CREATE POLICY "Company users create private groups"
ON public.private_groups FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id() AND created_by = auth.uid());
CREATE POLICY "Company group admins update groups"
ON public.private_groups FOR UPDATE TO authenticated
USING (company_id = public.current_company_id() AND public.is_group_admin(id))
WITH CHECK (company_id = public.current_company_id() AND public.is_group_admin(id));
CREATE POLICY "Company group admins delete groups"
ON public.private_groups FOR DELETE TO authenticated
USING (company_id = public.current_company_id() AND public.is_group_admin(id));

DROP POLICY IF EXISTS "Members can view group members" ON public.private_group_members;
DROP POLICY IF EXISTS "Admins can add members" ON public.private_group_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON public.private_group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON public.private_group_members;
CREATE POLICY "Company members view group membership"
ON public.private_group_members FOR SELECT TO authenticated
USING (
  public.is_group_member(group_id)
  AND EXISTS (SELECT 1 FROM public.private_groups pg WHERE pg.id = group_id AND pg.company_id = public.current_company_id())
);
CREATE POLICY "Company group admins add members"
ON public.private_group_members FOR INSERT TO authenticated
WITH CHECK (
  (public.is_group_admin(group_id) OR (user_id = auth.uid() AND public.is_group_empty(group_id)))
  AND EXISTS (SELECT 1 FROM public.private_groups pg WHERE pg.id = group_id AND pg.company_id = public.current_company_id())
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = user_id AND p.company_id = public.current_company_id())
);
CREATE POLICY "Company group admins update membership"
ON public.private_group_members FOR UPDATE TO authenticated
USING (public.is_group_admin(group_id) AND EXISTS (SELECT 1 FROM public.private_groups pg WHERE pg.id = group_id AND pg.company_id = public.current_company_id()))
WITH CHECK (public.is_group_admin(group_id) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = user_id AND p.company_id = public.current_company_id()));
CREATE POLICY "Company group admins remove membership"
ON public.private_group_members FOR DELETE TO authenticated
USING ((public.is_group_admin(group_id) OR user_id = auth.uid()) AND EXISTS (SELECT 1 FROM public.private_groups pg WHERE pg.id = group_id AND pg.company_id = public.current_company_id()));

DROP POLICY IF EXISTS "Users can view messages in their groups" ON public.private_group_messages;
DROP POLICY IF EXISTS "Group members can send messages" ON public.private_group_messages;
DROP POLICY IF EXISTS "Group admins can delete messages" ON public.private_group_messages;
CREATE POLICY "Company members view group messages"
ON public.private_group_messages FOR SELECT TO authenticated
USING (public.is_group_member(group_id) AND EXISTS (SELECT 1 FROM public.private_groups pg WHERE pg.id = group_id AND pg.company_id = public.current_company_id()));
CREATE POLICY "Company members send group messages"
ON public.private_group_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = public.get_current_profile_id()
  AND public.is_group_member(group_id)
  AND EXISTS (SELECT 1 FROM public.private_groups pg WHERE pg.id = group_id AND pg.company_id = public.current_company_id())
);
CREATE POLICY "Company group admins delete group messages"
ON public.private_group_messages FOR DELETE TO authenticated
USING (public.is_group_admin(group_id) AND EXISTS (SELECT 1 FROM public.private_groups pg WHERE pg.id = group_id AND pg.company_id = public.current_company_id()));

-- War-room membership must point to a user in the same company as the room.
DROP POLICY IF EXISTS "Permitted users can manage members" ON public.war_room_members;
CREATE POLICY "Permitted company users add war room members"
ON public.war_room_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.war_rooms wr
    JOIN public.profiles p ON p.user_id = war_room_members.user_id
    WHERE wr.id = war_room_members.war_room_id
      AND wr.company_id = public.current_company_id()
      AND p.company_id = wr.company_id
  )
  AND (
    public.is_admin()
    OR public.has_autonomy_level('supervisor')
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND (up.can_access_management = true OR up.can_create_war_room = true)
    )
  )
);