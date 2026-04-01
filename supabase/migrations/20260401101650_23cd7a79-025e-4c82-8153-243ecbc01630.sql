
-- Add team_name to supervisor_team_members
ALTER TABLE public.supervisor_team_members ADD COLUMN IF NOT EXISTS team_name text DEFAULT null;

-- Create api_integrations table
CREATE TABLE public.api_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_key text NOT NULL,
  api_token_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone DEFAULT null
);

ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins and supervisors can manage api integrations" ON public.api_integrations
  FOR ALL TO authenticated
  USING (is_admin() OR has_autonomy_level('supervisor'))
  WITH CHECK (is_admin() OR has_autonomy_level('supervisor'));

-- Create api_access_logs table
CREATE TABLE public.api_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES public.api_integrations(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  ip_address text DEFAULT null,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.api_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins and supervisors can view api logs" ON public.api_access_logs
  FOR SELECT TO authenticated
  USING (is_admin() OR has_autonomy_level('supervisor'));

CREATE POLICY "System can insert api logs" ON public.api_access_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Create api_integration_history table for audit
CREATE TABLE public.api_integration_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES public.api_integrations(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  performed_by uuid NOT NULL,
  details text DEFAULT null,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.api_integration_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins and supervisors can view history" ON public.api_integration_history
  FOR SELECT TO authenticated
  USING (is_admin() OR has_autonomy_level('supervisor'));

CREATE POLICY "System can insert history" ON public.api_integration_history
  FOR INSERT TO authenticated
  WITH CHECK (true);
