-- Google Agenda/Drive integration removed: drop its tables, functions, triggers and saved settings.
DROP TRIGGER IF EXISTS integrations_calendar_sync ON public.calendar_events;
DROP TRIGGER IF EXISTS integrations_participants_sync ON public.meeting_participants;
DROP FUNCTION IF EXISTS public.integrations_calendar_change();
DROP FUNCTION IF EXISTS public.my_google_status();
DROP TABLE IF EXISTS public.google_event_links;
DROP TABLE IF EXISTS public.user_google_accounts;
DROP TABLE IF EXISTS public.task_attachments;
DELETE FROM public.company_integrations WHERE provider = 'google';
ALTER TABLE public.company_integrations DROP CONSTRAINT IF EXISTS company_integrations_provider_check;
ALTER TABLE public.company_integrations ADD CONSTRAINT company_integrations_provider_check CHECK (provider IN ('slack', 'teams', 'whatsapp'));
