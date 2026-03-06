
-- Subtask groups table
CREATE TABLE public.subtask_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add group_id to task_subtasks
ALTER TABLE public.task_subtasks ADD COLUMN group_id UUID REFERENCES public.subtask_groups(id) ON DELETE CASCADE;

-- Auto-subtasks for columns (template subtasks that get created for cards in the column)
CREATE TABLE public.column_auto_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id UUID REFERENCES public.task_board_columns(id) ON DELETE CASCADE NOT NULL,
  group_title TEXT NOT NULL DEFAULT 'Geral',
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for subtask_groups
ALTER TABLE public.subtask_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can view subtask groups"
ON public.subtask_groups FOR SELECT
USING (EXISTS (
  SELECT 1 FROM tasks t WHERE t.id = subtask_groups.task_id AND is_board_member(t.board_id)
));

CREATE POLICY "Board members can insert subtask groups"
ON public.subtask_groups FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM tasks t WHERE t.id = subtask_groups.task_id AND is_board_member(t.board_id)
));

CREATE POLICY "Board members can update subtask groups"
ON public.subtask_groups FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM tasks t WHERE t.id = subtask_groups.task_id AND is_board_member(t.board_id)
));

CREATE POLICY "Board members can delete subtask groups"
ON public.subtask_groups FOR DELETE
USING (EXISTS (
  SELECT 1 FROM tasks t WHERE t.id = subtask_groups.task_id AND is_board_member(t.board_id)
));

-- RLS for column_auto_subtasks
ALTER TABLE public.column_auto_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can view column auto subtasks"
ON public.column_auto_subtasks FOR SELECT
USING (EXISTS (
  SELECT 1 FROM task_board_columns c WHERE c.id = column_auto_subtasks.column_id AND is_board_member(c.board_id)
));

CREATE POLICY "Board members can insert column auto subtasks"
ON public.column_auto_subtasks FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM task_board_columns c WHERE c.id = column_auto_subtasks.column_id AND is_board_member(c.board_id)
));

CREATE POLICY "Board members can update column auto subtasks"
ON public.column_auto_subtasks FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM task_board_columns c WHERE c.id = column_auto_subtasks.column_id AND is_board_member(c.board_id)
));

CREATE POLICY "Board members can delete column auto subtasks"
ON public.column_auto_subtasks FOR DELETE
USING (EXISTS (
  SELECT 1 FROM task_board_columns c WHERE c.id = column_auto_subtasks.column_id AND is_board_member(c.board_id)
));

-- Workflow rules table (column movement restrictions)
CREATE TABLE public.column_workflow_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID REFERENCES public.task_boards(id) ON DELETE CASCADE NOT NULL,
  source_column_id UUID REFERENCES public.task_board_columns(id) ON DELETE CASCADE,
  target_column_id UUID REFERENCES public.task_board_columns(id) ON DELETE CASCADE NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'block_direct',
  required_column_id UUID REFERENCES public.task_board_columns(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.column_workflow_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can view workflow rules"
ON public.column_workflow_rules FOR SELECT
USING (is_board_member(board_id));

CREATE POLICY "Board members can insert workflow rules"
ON public.column_workflow_rules FOR INSERT
WITH CHECK (is_board_member(board_id));

CREATE POLICY "Board members can update workflow rules"
ON public.column_workflow_rules FOR UPDATE
USING (is_board_member(board_id));

CREATE POLICY "Board members can delete workflow rules"
ON public.column_workflow_rules FOR DELETE
USING (is_board_member(board_id));

-- Update is_board_member to also consider admin role
CREATE OR REPLACE FUNCTION public.is_board_admin_or_owner(check_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_boards WHERE id = check_board_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM task_board_members WHERE board_id = check_board_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Allow admins to update boards too
CREATE POLICY "Board admins can update boards"
ON public.task_boards FOR UPDATE
USING (is_board_admin_or_owner(id));
