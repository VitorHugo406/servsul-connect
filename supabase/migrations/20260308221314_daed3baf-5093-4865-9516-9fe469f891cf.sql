
-- Monthly score snapshots for tracking performance history
CREATE TABLE public.monthly_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  board_id uuid REFERENCES public.task_boards(id) ON DELETE CASCADE,
  year_month text NOT NULL, -- format: '2026-03'
  score integer NOT NULL DEFAULT 0,
  total_tasks integer NOT NULL DEFAULT 0,
  completed_tasks integer NOT NULL DEFAULT 0,
  late_tasks integer NOT NULL DEFAULT 0,
  on_time_tasks integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(profile_id, board_id, year_month)
);

-- Also allow null board_id for global scores
CREATE UNIQUE INDEX monthly_scores_global_unique ON public.monthly_scores (profile_id, year_month) WHERE board_id IS NULL;

ALTER TABLE public.monthly_scores ENABLE ROW LEVEL SECURITY;

-- Board members can view scores for their boards
CREATE POLICY "Board members can view board scores"
ON public.monthly_scores FOR SELECT
USING (
  (board_id IS NOT NULL AND is_board_member(board_id))
  OR (board_id IS NULL AND (
    is_admin() OR profile_id = get_current_profile_id()
    OR EXISTS (
      SELECT 1 FROM supervisor_team_members stm 
      WHERE stm.supervisor_id = auth.uid() AND stm.member_profile_id = monthly_scores.profile_id
    )
  ))
);

-- System can insert/update scores
CREATE POLICY "Authenticated can insert scores"
ON public.monthly_scores FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated can update scores"
ON public.monthly_scores FOR UPDATE
USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_scores;
