
-- Add conclusion automation flag to columns
ALTER TABLE public.task_board_columns ADD COLUMN IF NOT EXISTS is_conclusion boolean DEFAULT false;

-- Add completion tracking to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_late boolean DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS delay_days integer DEFAULT 0;
