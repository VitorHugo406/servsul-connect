
-- Update the insert policy to include can_create_war_room permission
DROP POLICY "Permitted users can create war rooms" ON public.war_rooms;
CREATE POLICY "Permitted users can create war rooms" ON public.war_rooms FOR INSERT WITH CHECK (
  is_admin() OR has_autonomy_level('supervisor') OR (EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND (can_access_management = true OR can_create_war_room = true)))
);

-- Update members insert policy too
DROP POLICY "Permitted users can manage members" ON public.war_room_members;
CREATE POLICY "Permitted users can manage members" ON public.war_room_members FOR INSERT WITH CHECK (
  is_admin() OR has_autonomy_level('supervisor') OR (EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND (can_access_management = true OR can_create_war_room = true)))
);

DROP POLICY "Permitted users can remove members" ON public.war_room_members;
CREATE POLICY "Permitted users can remove members" ON public.war_room_members FOR DELETE USING (
  is_admin() OR has_autonomy_level('supervisor') OR (EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND (can_access_management = true OR can_create_war_room = true)))
);
