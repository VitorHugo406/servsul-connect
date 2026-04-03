
-- Evaluation positions/roles (cargos)
CREATE TABLE public.eval_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Competencies
CREATE TABLE public.eval_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'behavioral',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Position-competency mapping with weights
CREATE TABLE public.eval_position_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.eval_positions(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES public.eval_competencies(id) ON DELETE CASCADE,
  weight numeric NOT NULL DEFAULT 1,
  min_expected_score numeric DEFAULT 3,
  requires_comment boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(position_id, competency_id)
);

-- Evaluation cycles
CREATE TABLE public.eval_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Evaluations (main record)
CREATE TABLE public.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES public.eval_cycles(id) ON DELETE SET NULL,
  evaluator_id uuid NOT NULL,
  evaluated_id uuid NOT NULL,
  position_id uuid REFERENCES public.eval_positions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  overall_comment text,
  overall_score numeric,
  evaluated_comment text,
  evaluator_response text,
  sent_at timestamptz,
  responded_at timestamptz,
  finalized_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Evaluation items (one per competency)
CREATE TABLE public.evaluation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES public.eval_competencies(id) ON DELETE CASCADE,
  score numeric,
  weight numeric NOT NULL DEFAULT 1,
  evaluator_comment text,
  evaluated_response text,
  evaluator_reply text,
  classification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Evaluation history/audit trail
CREATE TABLE public.evaluation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by uuid NOT NULL,
  old_status text,
  new_status text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Teams table for multi-team support
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  supervisor_id uuid NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Team members
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, profile_id)
);

-- RLS
ALTER TABLE public.eval_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_position_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view positions" ON public.eval_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage positions" ON public.eval_positions FOR ALL TO authenticated USING (is_admin() OR has_autonomy_level('supervisor')) WITH CHECK (is_admin() OR has_autonomy_level('supervisor'));

CREATE POLICY "Authenticated can view competencies" ON public.eval_competencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage competencies" ON public.eval_competencies FOR ALL TO authenticated USING (is_admin() OR has_autonomy_level('supervisor')) WITH CHECK (is_admin() OR has_autonomy_level('supervisor'));

CREATE POLICY "Authenticated can view position competencies" ON public.eval_position_competencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage position competencies" ON public.eval_position_competencies FOR ALL TO authenticated USING (is_admin() OR has_autonomy_level('supervisor')) WITH CHECK (is_admin() OR has_autonomy_level('supervisor'));

CREATE POLICY "Authenticated can view cycles" ON public.eval_cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage cycles" ON public.eval_cycles FOR ALL TO authenticated USING (is_admin() OR has_autonomy_level('supervisor')) WITH CHECK (is_admin() OR has_autonomy_level('supervisor'));

CREATE POLICY "Users can view own evaluations" ON public.evaluations FOR SELECT TO authenticated USING (evaluator_id = get_current_profile_id() OR evaluated_id = get_current_profile_id() OR is_admin() OR has_autonomy_level('supervisor'));
CREATE POLICY "Evaluators can create evaluations" ON public.evaluations FOR INSERT TO authenticated WITH CHECK (evaluator_id = get_current_profile_id() OR is_admin() OR has_autonomy_level('supervisor'));
CREATE POLICY "Evaluators can update evaluations" ON public.evaluations FOR UPDATE TO authenticated USING (evaluator_id = get_current_profile_id() OR evaluated_id = get_current_profile_id() OR is_admin() OR has_autonomy_level('supervisor'));
CREATE POLICY "Admins can delete evaluations" ON public.evaluations FOR DELETE TO authenticated USING (is_admin());

CREATE POLICY "Users can view evaluation items" ON public.evaluation_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_items.evaluation_id AND (e.evaluator_id = get_current_profile_id() OR e.evaluated_id = get_current_profile_id() OR is_admin() OR has_autonomy_level('supervisor'))));
CREATE POLICY "Evaluators can manage items" ON public.evaluation_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_items.evaluation_id AND (e.evaluator_id = get_current_profile_id() OR is_admin() OR has_autonomy_level('supervisor')))) WITH CHECK (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_items.evaluation_id AND (e.evaluator_id = get_current_profile_id() OR is_admin() OR has_autonomy_level('supervisor'))));
CREATE POLICY "Evaluated can respond to items" ON public.evaluation_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_items.evaluation_id AND e.evaluated_id = get_current_profile_id()));

CREATE POLICY "Users can view evaluation history" ON public.evaluation_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_history.evaluation_id AND (e.evaluator_id = get_current_profile_id() OR e.evaluated_id = get_current_profile_id() OR is_admin() OR has_autonomy_level('supervisor'))));
CREATE POLICY "System can insert evaluation history" ON public.evaluation_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Supervisors can manage own teams" ON public.teams FOR ALL TO authenticated USING (supervisor_id = auth.uid() OR is_admin()) WITH CHECK (supervisor_id = auth.uid() OR is_admin());
CREATE POLICY "Authenticated can view teams" ON public.teams FOR SELECT TO authenticated USING (true);

CREATE POLICY "Team owners can manage members" ON public.team_members FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND (t.supervisor_id = auth.uid() OR is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND (t.supervisor_id = auth.uid() OR is_admin())));
CREATE POLICY "Authenticated can view team members" ON public.team_members FOR SELECT TO authenticated USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_eval_positions_updated_at BEFORE UPDATE ON public.eval_positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_eval_cycles_updated_at BEFORE UPDATE ON public.eval_cycles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_evaluations_updated_at BEFORE UPDATE ON public.evaluations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_evaluation_items_updated_at BEFORE UPDATE ON public.evaluation_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
