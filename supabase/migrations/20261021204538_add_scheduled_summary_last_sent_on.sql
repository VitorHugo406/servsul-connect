ALTER TABLE public.scheduled_summaries
  ADD COLUMN IF NOT EXISTS last_sent_on date;

CREATE INDEX IF NOT EXISTS idx_scheduled_summaries_due
  ON public.scheduled_summaries (is_active, send_time, last_sent_on);
