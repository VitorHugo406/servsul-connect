
-- Add automation columns to task_board_columns
ALTER TABLE public.task_board_columns ADD COLUMN auto_assign_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.task_board_columns ADD COLUMN auto_cover text;

-- Add CASCADE delete for task_boards children
ALTER TABLE public.task_board_columns DROP CONSTRAINT IF EXISTS task_board_columns_board_id_fkey;
ALTER TABLE public.task_board_columns ADD CONSTRAINT task_board_columns_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.task_boards(id) ON DELETE CASCADE;

ALTER TABLE public.task_board_members DROP CONSTRAINT IF EXISTS task_board_members_board_id_fkey;
ALTER TABLE public.task_board_members ADD CONSTRAINT task_board_members_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.task_boards(id) ON DELETE CASCADE;

-- Tasks with board_id should cascade on board delete
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_board_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.task_boards(id) ON DELETE CASCADE;

-- Task comments should cascade on task delete
ALTER TABLE public.task_comments DROP CONSTRAINT IF EXISTS task_comments_task_id_fkey;
ALTER TABLE public.task_comments ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
