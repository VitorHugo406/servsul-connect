
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS reminder_minutes integer DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.task_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  action_type text NOT NULL,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.task_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can view task activities"
ON public.task_activities FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tasks t
  JOIN public.task_board_members bm ON bm.board_id = t.board_id
  WHERE t.id = task_activities.task_id AND bm.user_id = auth.uid()
));

CREATE POLICY "Authenticated can insert task activities"
ON public.task_activities FOR INSERT TO authenticated
WITH CHECK (true);
