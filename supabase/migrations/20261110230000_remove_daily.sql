-- Daily.co removed: ewvon calls are peer-to-peer (WebRTC) with Supabase Realtime signaling, no per-minute cost.
-- Drops the usage/billing bookkeeping. The 'video_calls' plan feature (Empresarial) and calendar_events.video_room
-- (marks meetings that have an ewvon call) stay.
SELECT cron.unschedule('ewvon-video-usage') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ewvon-video-usage');
DROP FUNCTION IF EXISTS public.my_video_usage();
DROP FUNCTION IF EXISTS public.set_video_overage(boolean);
DROP TABLE IF EXISTS public.company_video_usage;
DROP TABLE IF EXISTS public.video_usage;
DROP TABLE IF EXISTS public.video_rooms;
ALTER TABLE public.billing_settings DROP COLUMN IF EXISTS video_free_minutes, DROP COLUMN IF EXISTS video_price_per_minute, DROP COLUMN IF EXISTS video_minutes_limit;
ALTER TABLE public.company_subscriptions DROP COLUMN IF EXISTS video_overage_allowed;
UPDATE public.calendar_events SET video_room = 'ewvon', meeting_link = NULL WHERE video_room IS NOT NULL;
