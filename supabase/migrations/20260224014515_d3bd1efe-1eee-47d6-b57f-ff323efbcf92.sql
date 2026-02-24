-- Create calendar events table for admin
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'meeting',
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  all_day BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  reminder_minutes INTEGER,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Only admin can manage calendar events
CREATE POLICY "Admin can manage calendar events"
ON public.calendar_events
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
