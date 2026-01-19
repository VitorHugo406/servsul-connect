-- Create private_groups table for group chat functionality
CREATE TABLE IF NOT EXISTS public.private_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create private_group_members table
CREATE TABLE IF NOT EXISTS public.private_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.private_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin', 'member'
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, profile_id)
);

-- Create private_group_messages table
CREATE TABLE IF NOT EXISTS public.private_group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.private_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create private_group_message_reads table
CREATE TABLE IF NOT EXISTS public.private_group_message_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.private_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE public.private_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_group_message_reads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for private_groups
CREATE POLICY "Users can view groups they are members of"
ON public.private_groups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.private_group_members
    WHERE group_id = id AND user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can create groups"
ON public.private_groups FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Group admins can update their groups"
ON public.private_groups FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.private_group_members
    WHERE group_id = id AND user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Group admins can delete their groups"
ON public.private_groups FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.private_group_members
    WHERE group_id = id AND user_id = auth.uid() AND role = 'admin'
  )
);

-- RLS Policies for private_group_members
CREATE POLICY "Users can view members of groups they are in"
ON public.private_group_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.private_group_members m
    WHERE m.group_id = private_group_members.group_id AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Group admins can add members"
ON public.private_group_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.private_group_members
    WHERE group_id = private_group_members.group_id AND user_id = auth.uid() AND role = 'admin'
  ) OR
  -- Allow creator to add themselves as first member
  NOT EXISTS (
    SELECT 1 FROM public.private_group_members WHERE group_id = private_group_members.group_id
  )
);

CREATE POLICY "Group admins can remove members"
ON public.private_group_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.private_group_members m
    WHERE m.group_id = private_group_members.group_id AND m.user_id = auth.uid() AND m.role = 'admin'
  ) OR user_id = auth.uid() -- Users can leave groups
);

-- RLS Policies for private_group_messages
CREATE POLICY "Users can view messages in their groups"
ON public.private_group_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.private_group_members
    WHERE group_id = private_group_messages.group_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Group members can send messages"
ON public.private_group_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.private_group_members
    WHERE group_id = private_group_messages.group_id AND user_id = auth.uid()
  ) AND sender_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- RLS Policies for private_group_message_reads
CREATE POLICY "Users can view their read status"
ON public.private_group_message_reads FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their read status"
ON public.private_group_message_reads FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own read status"
ON public.private_group_message_reads FOR UPDATE
USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_private_group_members_user_id ON public.private_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_private_group_members_group_id ON public.private_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_private_group_messages_group_id ON public.private_group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_private_group_messages_created_at ON public.private_group_messages(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_private_groups_updated_at
BEFORE UPDATE ON public.private_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for group messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_group_messages;