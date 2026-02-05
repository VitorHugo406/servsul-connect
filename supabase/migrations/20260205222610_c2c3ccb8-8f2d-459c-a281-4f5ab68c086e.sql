
-- Create task_boards table for individual boards/murals
CREATE TABLE public.task_boards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL,
  background_image text DEFAULT 'default',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create task_board_members table
CREATE TABLE public.task_board_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id uuid NOT NULL REFERENCES public.task_boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(board_id, user_id)
);

-- Create task_board_columns for custom columns
CREATE TABLE public.task_board_columns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id uuid NOT NULL REFERENCES public.task_boards(id) ON DELETE CASCADE,
  title text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add board_id and cover_image to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS board_id uuid REFERENCES public.task_boards(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS cover_image text;

-- Enable RLS
ALTER TABLE public.task_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_board_columns ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is board member or owner
CREATE OR REPLACE FUNCTION public.is_board_member(check_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_boards WHERE id = check_board_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM task_board_members WHERE board_id = check_board_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_board_owner(check_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_boards WHERE id = check_board_id AND owner_id = auth.uid()
  );
$$;

-- task_boards policies
CREATE POLICY "Users can create boards" ON public.task_boards
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Board members and owners can view boards" ON public.task_boards
  FOR SELECT USING (is_board_member(id) OR owner_id = auth.uid());

CREATE POLICY "Board owners can update boards" ON public.task_boards
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Board owners can delete boards" ON public.task_boards
  FOR DELETE USING (owner_id = auth.uid());

-- task_board_members policies
CREATE POLICY "Board owners can manage members" ON public.task_board_members
  FOR ALL USING (is_board_owner(board_id)) WITH CHECK (is_board_owner(board_id));

CREATE POLICY "Members can view board members" ON public.task_board_members
  FOR SELECT USING (is_board_member(board_id));

CREATE POLICY "Members can leave boards" ON public.task_board_members
  FOR DELETE USING (user_id = auth.uid());

-- task_board_columns policies
CREATE POLICY "Board members can view columns" ON public.task_board_columns
  FOR SELECT USING (is_board_member(board_id));

CREATE POLICY "Board owners can manage columns" ON public.task_board_columns
  FOR ALL USING (is_board_owner(board_id)) WITH CHECK (is_board_owner(board_id));

CREATE POLICY "Board members can manage columns" ON public.task_board_columns
  FOR INSERT WITH CHECK (is_board_member(board_id));

CREATE POLICY "Board members can update columns" ON public.task_board_columns
  FOR UPDATE USING (is_board_member(board_id));

-- Update tasks RLS to include board-based access
CREATE POLICY "Board members can view board tasks" ON public.tasks
  FOR SELECT USING (board_id IS NOT NULL AND is_board_member(board_id));

CREATE POLICY "Board members can create board tasks" ON public.tasks
  FOR INSERT WITH CHECK (board_id IS NOT NULL AND is_board_member(board_id) AND created_by = get_current_profile_id());

CREATE POLICY "Board members can update board tasks" ON public.tasks
  FOR UPDATE USING (board_id IS NOT NULL AND is_board_member(board_id));

CREATE POLICY "Board members can delete board tasks" ON public.tasks
  FOR DELETE USING (board_id IS NOT NULL AND (is_board_owner(board_id) OR created_by = get_current_profile_id()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_board_columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_board_members;

-- Trigger for updated_at
CREATE TRIGGER update_task_boards_updated_at
  BEFORE UPDATE ON public.task_boards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
