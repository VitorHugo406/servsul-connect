-- Google Agenda + Google Drive.
-- Each company registers ITS OWN Google Cloud OAuth client in the Integrações tab (client secret encrypted
-- by the edge function). Then every employee connects their own Google account: their ewvon meetings go
-- to their Google Calendar and they can attach Drive files to task cards.

CREATE TABLE IF NOT EXISTS public.user_google_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  google_email text, refresh_token_enc text NOT NULL, scopes text,
  connected_at timestamptz NOT NULL DEFAULT now(), last_error text
);
ALTER TABLE public.user_google_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_google_accounts FROM anon, authenticated;

-- Which Google event mirrors which ewvon event for each person (no FK: survives the event's deletion).
CREATE TABLE IF NOT EXISTS public.google_event_links (
  event_id uuid NOT NULL, user_id uuid NOT NULL, google_event_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (event_id, user_id)
);
ALTER TABLE public.google_event_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_event_links FROM anon, authenticated;

-- What the signed-in user sees in the tab (no tokens).
CREATE OR REPLACE FUNCTION public.my_google_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'company_configured', EXISTS (SELECT 1 FROM public.company_integrations WHERE company_id = public.current_company_id() AND provider = 'google' AND enabled AND secret_enc IS NOT NULL),
    'email', (SELECT google_email FROM public.user_google_accounts WHERE user_id = auth.uid()),
    'connected_at', (SELECT connected_at FROM public.user_google_accounts WHERE user_id = auth.uid()),
    'last_error', (SELECT last_error FROM public.user_google_accounts WHERE user_id = auth.uid()))
$$;
REVOKE EXECUTE ON FUNCTION public.my_google_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_google_status() TO authenticated;

-- Calendar changes -> edge function (event 'calendar_sync'), only when the company has Google configured.
CREATE OR REPLACE FUNCTION public.integrations_calendar_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev uuid; comp uuid;
BEGIN
  IF TG_TABLE_NAME = 'calendar_events' THEN
    ev := coalesce(NEW.id, OLD.id); comp := coalesce(NEW.company_id, OLD.company_id);
  ELSE
    ev := coalesce(NEW.event_id, OLD.event_id);
    SELECT company_id INTO comp FROM public.calendar_events WHERE id = ev;
  END IF;
  PERFORM public.integrations_enqueue(comp, 'calendar_sync', ev::text);
  RETURN coalesce(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.integrations_calendar_change() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS integrations_calendar_sync ON public.calendar_events;
CREATE TRIGGER integrations_calendar_sync AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.integrations_calendar_change();
DROP TRIGGER IF EXISTS integrations_participants_sync ON public.meeting_participants;
CREATE TRIGGER integrations_participants_sync AFTER INSERT OR DELETE ON public.meeting_participants FOR EACH ROW EXECUTE FUNCTION public.integrations_calendar_change();
