
-- Create task_assignees junction table for multiple assignees per task
CREATE TABLE public.task_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, profile_id)
);

-- Enable RLS
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- Policies: same access as tasks (board members)
CREATE POLICY "Board members can view task assignees"
  ON public.task_assignees FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_assignees.task_id AND t.board_id IS NOT NULL AND is_board_member(t.board_id)
  ));

CREATE POLICY "Board members can manage task assignees"
  ON public.task_assignees FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_assignees.task_id AND t.board_id IS NOT NULL AND is_board_member(t.board_id)
  ));

CREATE POLICY "Board members can delete task assignees"
  ON public.task_assignees FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_assignees.task_id AND t.board_id IS NOT NULL AND is_board_member(t.board_id)
  ));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignees;

-- Enable pg_cron and pg_net extensions for scheduled feedback
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
