-- Add is_archived column to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Index for quick filtering
CREATE INDEX IF NOT EXISTS idx_tasks_is_archived ON public.tasks(is_archived) WHERE is_archived = true;
