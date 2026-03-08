
-- War Rooms table
CREATE TABLE public.war_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- War Room members
CREATE TABLE public.war_room_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  war_room_id UUID NOT NULL REFERENCES public.war_rooms(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  has_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(war_room_id, profile_id)
);

-- War Room timeline incidents
CREATE TABLE public.war_room_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  war_room_id UUID NOT NULL REFERENCES public.war_rooms(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- War Room messages (chat)
CREATE TABLE public.war_room_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  war_room_id UUID NOT NULL REFERENCES public.war_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.war_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.war_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.war_room_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.war_room_messages ENABLE ROW LEVEL SECURITY;

-- War Rooms policies: all authenticated can view, only permitted can create
CREATE POLICY "All authenticated can view war rooms" ON public.war_rooms FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Permitted users can create war rooms" ON public.war_rooms FOR INSERT WITH CHECK (
  is_admin() OR has_autonomy_level('supervisor') OR (EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND can_access_management = true))
);
CREATE POLICY "Creators and admins can update war rooms" ON public.war_rooms FOR UPDATE USING (created_by = auth.uid() OR is_admin());
CREATE POLICY "Admins can delete war rooms" ON public.war_rooms FOR DELETE USING (is_admin());

-- War Room members policies
CREATE POLICY "All authenticated can view war room members" ON public.war_room_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Permitted users can manage members" ON public.war_room_members FOR INSERT WITH CHECK (
  is_admin() OR has_autonomy_level('supervisor') OR (EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND can_access_management = true))
);
CREATE POLICY "Members can acknowledge" ON public.war_room_members FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Permitted users can remove members" ON public.war_room_members FOR DELETE USING (
  is_admin() OR has_autonomy_level('supervisor') OR (EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND can_access_management = true))
);

-- Timeline policies: all can view, members can add
CREATE POLICY "All authenticated can view timeline" ON public.war_room_timeline FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Members can add timeline entries" ON public.war_room_timeline FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.war_room_members WHERE war_room_id = war_room_timeline.war_room_id AND user_id = auth.uid())
  OR is_admin() OR has_autonomy_level('supervisor')
);
CREATE POLICY "Admins can delete timeline" ON public.war_room_timeline FOR DELETE USING (is_admin() OR created_by = auth.uid());

-- Messages policies: members can chat
CREATE POLICY "Members can view war room messages" ON public.war_room_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.war_room_members WHERE war_room_id = war_room_messages.war_room_id AND user_id = auth.uid())
  OR is_admin()
);
CREATE POLICY "Members can send war room messages" ON public.war_room_messages FOR INSERT WITH CHECK (
  (EXISTS (SELECT 1 FROM public.war_room_members WHERE war_room_id = war_room_messages.war_room_id AND user_id = auth.uid())
  OR is_admin())
  AND sender_id = get_current_profile_id()
);

-- Enable realtime for war room messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.war_room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.war_room_members;

-- Trigger for updated_at
CREATE TRIGGER update_war_rooms_updated_at BEFORE UPDATE ON public.war_rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
