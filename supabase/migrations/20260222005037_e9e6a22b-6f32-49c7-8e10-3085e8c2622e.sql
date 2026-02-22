
-- Table for task automation rules (SE → ENTÃO engine)
CREATE TABLE public.task_automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.task_boards(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL, -- 'deadline_approaching', 'stuck_days', 'checklist_complete', 'label_urgent'
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"hours": 24}, {"days": 3}
  action_type TEXT NOT NULL, -- 'notify', 'move_column', 'set_priority', 'alert'
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"column_id": "..."}, {"priority": "high"}
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can view automation rules"
  ON public.task_automation_rules FOR SELECT
  USING (is_board_member(board_id));

CREATE POLICY "Board members can create automation rules"
  ON public.task_automation_rules FOR INSERT
  WITH CHECK (is_board_member(board_id));

CREATE POLICY "Board members can update automation rules"
  ON public.task_automation_rules FOR UPDATE
  USING (is_board_member(board_id));

CREATE POLICY "Board members can delete automation rules"
  ON public.task_automation_rules FOR DELETE
  USING (is_board_member(board_id));

-- Table for workload alerts that surface in People Management
CREATE TABLE public.workload_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL,
  board_id UUID REFERENCES public.task_boards(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'overloaded', 'deadline_risk', 'stuck_task', 'late_task'
  message TEXT NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workload_alerts ENABLE ROW LEVEL SECURITY;

-- Alerts visible to the supervisor linked to that person, or admin
CREATE POLICY "Supervisors can view alerts for their team"
  ON public.workload_alerts FOR SELECT
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM supervisor_team_members stm
      WHERE stm.supervisor_id = auth.uid()
        AND stm.member_profile_id = workload_alerts.profile_id
    )
  );

CREATE POLICY "System can insert workload alerts"
  ON public.workload_alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Supervisors can update alerts"
  ON public.workload_alerts FOR UPDATE
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM supervisor_team_members stm
      WHERE stm.supervisor_id = auth.uid()
        AND stm.member_profile_id = workload_alerts.profile_id
    )
  );

CREATE POLICY "Supervisors can delete alerts"
  ON public.workload_alerts FOR DELETE
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM supervisor_team_members stm
      WHERE stm.supervisor_id = auth.uid()
        AND stm.member_profile_id = workload_alerts.profile_id
    )
  );

-- Enable realtime for workload_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.workload_alerts;
