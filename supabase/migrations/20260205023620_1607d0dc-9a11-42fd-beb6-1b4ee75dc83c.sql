-- Fix RLS policies for private_groups to allow proper group creation
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.private_groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.private_groups;
DROP POLICY IF EXISTS "Group admins can update their groups" ON public.private_groups;
DROP POLICY IF EXISTS "Group admins can delete their groups" ON public.private_groups;

-- Create proper policies for private_groups
CREATE POLICY "Members can view their groups"
ON public.private_groups
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.private_group_members
    WHERE private_group_members.group_id = private_groups.id
    AND private_group_members.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can create groups"
ON public.private_groups
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Group admins can update their groups"
ON public.private_groups
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.private_group_members
    WHERE private_group_members.group_id = private_groups.id
    AND private_group_members.user_id = auth.uid()
    AND private_group_members.role = 'admin'
  )
);

CREATE POLICY "Group admins can delete their groups"
ON public.private_groups
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.private_group_members
    WHERE private_group_members.group_id = private_groups.id
    AND private_group_members.user_id = auth.uid()
    AND private_group_members.role = 'admin'
  )
);

-- Fix RLS policies for private_group_members
DROP POLICY IF EXISTS "Group admins can add members" ON public.private_group_members;
DROP POLICY IF EXISTS "Users can view members of groups they are in" ON public.private_group_members;

-- Policy for viewing members
CREATE POLICY "Members can view group members"
ON public.private_group_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.private_group_members m
    WHERE m.group_id = private_group_members.group_id
    AND m.user_id = auth.uid()
  )
);

-- Policy for adding members - admin can add OR creator adding themselves as first member
CREATE POLICY "Admins can add members"
ON public.private_group_members
FOR INSERT
WITH CHECK (
  -- Allow admins to add members
  EXISTS (
    SELECT 1 FROM public.private_group_members m
    WHERE m.group_id = private_group_members.group_id
    AND m.user_id = auth.uid()
    AND m.role = 'admin'
  )
  OR 
  -- Allow creator to add themselves as first member
  (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.private_group_members m
      WHERE m.group_id = private_group_members.group_id
    )
  )
);

-- Policy for updating members (role changes)
CREATE POLICY "Admins can update member roles"
ON public.private_group_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.private_group_members m
    WHERE m.group_id = private_group_members.group_id
    AND m.user_id = auth.uid()
    AND m.role = 'admin'
  )
);

-- Add new autonomy levels to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'diretoria';

-- Create tasks table for Trello-style task management
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_number SERIAL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES public.profiles(id),
  created_by UUID NOT NULL,
  sector_id UUID REFERENCES public.sectors(id),
  due_date TIMESTAMP WITH TIME ZONE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Task policies
CREATE POLICY "Users can view tasks in their sectors"
ON public.tasks
FOR SELECT
USING (
  is_admin() OR
  sector_id IS NULL OR
  sector_id = get_current_sector_id() OR
  sector_id = '00000000-0000-0000-0000-000000000001'::uuid OR
  EXISTS (
    SELECT 1 FROM public.user_additional_sectors
    WHERE user_additional_sectors.user_id = auth.uid()
    AND user_additional_sectors.sector_id = tasks.sector_id
  )
);

CREATE POLICY "Users can create tasks"
ON public.tasks
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND created_by = get_current_profile_id());

CREATE POLICY "Task creators and admins can update tasks"
ON public.tasks
FOR UPDATE
USING (
  is_admin() OR
  created_by = get_current_profile_id() OR
  assigned_to = get_current_profile_id()
);

CREATE POLICY "Task creators and admins can delete tasks"
ON public.tasks
FOR DELETE
USING (
  is_admin() OR created_by = get_current_profile_id()
);

-- Create task comments table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view task comments"
ON public.task_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks WHERE tasks.id = task_comments.task_id
  )
);

CREATE POLICY "Users can create task comments"
ON public.task_comments
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND author_id = get_current_profile_id());

CREATE POLICY "Authors can delete their comments"
ON public.task_comments
FOR DELETE
USING (author_id = get_current_profile_id() OR is_admin());

-- Create trigger for tasks updated_at
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;