-- Monthly cap for video calls so Daily.co stays inside its free allowance.
-- video_usage caches the participant-minutes Daily reports for each month (refreshed by the `video` function).
ALTER TABLE public.billing_settings ADD COLUMN IF NOT EXISTS video_minutes_limit integer NOT NULL DEFAULT 9500;
CREATE TABLE IF NOT EXISTS public.video_usage (
  month text PRIMARY KEY,                      -- 'YYYY-MM' (UTC, same as Daily's billing month)
  minutes integer NOT NULL DEFAULT 0,
  alerted_80 boolean NOT NULL DEFAULT false,
  alerted_100 boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.video_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.video_usage FROM anon, authenticated;
