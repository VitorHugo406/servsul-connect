
CREATE TABLE public.scheduled_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('group', 'sector')),
  target_id UUID NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  send_time TEXT NOT NULL DEFAULT '08:00',
  weekday INTEGER CHECK (weekday >= 0 AND weekday <= 6),
  month_day INTEGER CHECK (month_day >= 1 AND month_day <= 28),
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  format TEXT NOT NULL DEFAULT 'text' CHECK (format IN ('text', 'visual')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_summaries ENABLE ROW LEVEL SECURITY;

-- Only admins can manage scheduled summaries
CREATE POLICY "Admins can manage scheduled summaries"
  ON public.scheduled_summaries
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Group admins can manage their group summaries
CREATE POLICY "Group admins can manage group summaries"
  ON public.scheduled_summaries
  FOR ALL
  TO authenticated
  USING (target_type = 'group' AND is_group_admin(target_id))
  WITH CHECK (target_type = 'group' AND is_group_admin(target_id));

-- Authenticated users can view summaries for their groups/sectors
CREATE POLICY "Users can view relevant summaries"
  ON public.scheduled_summaries
  FOR SELECT
  TO authenticated
  USING (
    (target_type = 'group' AND is_group_member(target_id))
    OR (target_type = 'sector' AND user_has_sector_access(auth.uid(), target_id))
  );
