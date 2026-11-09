-- Company integrations (Integrações tab): Slack, Microsoft Teams and WhatsApp now; Google later.
-- Secrets (webhook URLs, access tokens) are encrypted by the `integrations` edge function and are never
-- readable from the app. Database triggers ask the edge function to deliver each event.

CREATE TABLE IF NOT EXISTS public.company_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('slack', 'teams', 'whatsapp', 'google')),
  enabled boolean NOT NULL DEFAULT true,
  events text[] NOT NULL DEFAULT ARRAY['announcement', 'important', 'task_assigned', 'meeting'],
  config jsonb NOT NULL DEFAULT '{}'::jsonb,          -- non-secret settings shown in the tab
  secret_enc text,                                    -- encrypted by the edge function
  last_status text, last_error text, last_used_at timestamptz,
  updated_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider)
);
ALTER TABLE public.company_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company admins read integrations" ON public.company_integrations;
CREATE POLICY "Company admins read integrations" ON public.company_integrations FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (company_id = public.current_company_id() AND public.is_admin()));
REVOKE ALL ON public.company_integrations FROM anon, authenticated;
GRANT SELECT (id, company_id, provider, enabled, events, config, last_status, last_error, last_used_at, updated_at) ON public.company_integrations TO authenticated;

CREATE TABLE IF NOT EXISTS public.integration_deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL, event text NOT NULL, ok boolean NOT NULL, detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS integration_deliveries_company ON public.integration_deliveries (company_id, created_at DESC);
ALTER TABLE public.integration_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company admins read deliveries" ON public.integration_deliveries;
CREATE POLICY "Company admins read deliveries" ON public.integration_deliveries FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (company_id = public.current_company_id() AND public.is_admin()));
REVOKE ALL ON public.integration_deliveries FROM anon, authenticated;
GRANT SELECT ON public.integration_deliveries TO authenticated;

-- Secret shared between the database and the edge function (Vault only).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'integrations_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'integrations_secret', 'Integrations dispatch');
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.integrations_secret_ok(_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT decrypted_secret = _secret FROM vault.decrypted_secrets WHERE name = 'integrations_secret'), false)
$$;
REVOKE EXECUTE ON FUNCTION public.integrations_secret_ok(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integrations_secret_ok(text) TO service_role;

-- Event -> edge function, only when the company has an enabled integration listening to it.
CREATE OR REPLACE FUNCTION public.integrations_enqueue(_company uuid, _event text, _ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _company IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.company_integrations WHERE company_id = _company AND enabled AND _event = ANY (events) AND secret_enc IS NOT NULL
  ) THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/integrations/dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-integrations-secret', s.decrypted_secret),
    body := jsonb_build_object('company_id', _company, 'event', _event, 'ref', _ref)
  ) FROM vault.decrypted_secrets s WHERE s.name = 'integrations_secret';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'integrations_enqueue: %', SQLERRM;  -- never block the user's action
END $$;
REVOKE EXECUTE ON FUNCTION public.integrations_enqueue(uuid, text, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.integrations_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'announcements' THEN
    PERFORM public.integrations_enqueue(NEW.company_id, 'announcement', NEW.id::text);
  ELSIF TG_TABLE_NAME = 'important_announcements' THEN
    PERFORM public.integrations_enqueue(NEW.company_id, 'important', NEW.id::text);
  ELSIF TG_TABLE_NAME = 'tasks' THEN
    IF NEW.assigned_to IS NOT NULL AND NOT coalesce(NEW.is_template, false)
       AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
      PERFORM public.integrations_enqueue(NEW.company_id, 'task_assigned', NEW.id::text);
    END IF;
  ELSIF TG_TABLE_NAME = 'calendar_events' THEN
    IF NEW.event_type = 'meeting' THEN PERFORM public.integrations_enqueue(NEW.company_id, 'meeting', NEW.id::text); END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.integrations_on_change() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS integrations_announcements ON public.announcements;
CREATE TRIGGER integrations_announcements AFTER INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.integrations_on_change();
DROP TRIGGER IF EXISTS integrations_important ON public.important_announcements;
CREATE TRIGGER integrations_important AFTER INSERT ON public.important_announcements FOR EACH ROW EXECUTE FUNCTION public.integrations_on_change();
DROP TRIGGER IF EXISTS integrations_tasks ON public.tasks;
CREATE TRIGGER integrations_tasks AFTER INSERT OR UPDATE OF assigned_to ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.integrations_on_change();
DROP TRIGGER IF EXISTS integrations_meetings ON public.calendar_events;
CREATE TRIGGER integrations_meetings AFTER INSERT ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.integrations_on_change();

-- Google Drive files attached to task cards (stage 2 uses it; links only, no storage used).
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_drive',
  name text NOT NULL, url text NOT NULL, mime_type text, icon_url text,
  added_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS set_company_id_default ON public.task_attachments;
CREATE TRIGGER set_company_id_default BEFORE INSERT ON public.task_attachments FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
DROP POLICY IF EXISTS "Company members use task attachments" ON public.task_attachments;
CREATE POLICY "Company members use task attachments" ON public.task_attachments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id))          -- tasks RLS decides who sees the card
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id) AND url ~ '^https://');
