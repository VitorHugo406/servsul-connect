
-- Update calendar_events RLS: allow all authenticated users
DROP POLICY IF EXISTS "Admin can manage calendar events" ON public.calendar_events;

CREATE POLICY "Authenticated users can view calendar events"
ON public.calendar_events FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create calendar events"
ON public.calendar_events FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Users can update their own events"
ON public.calendar_events FOR UPDATE
USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Users can delete their own events"
ON public.calendar_events FOR DELETE
USING (created_by = auth.uid() OR is_admin());

-- Create meeting participants table
CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, profile_id)
);

ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view meeting participants"
ON public.meeting_participants FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Event creators can manage participants"
ON public.meeting_participants FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.calendar_events ce
  WHERE ce.id = event_id AND (ce.created_by = auth.uid() OR is_admin())
));

CREATE POLICY "Event creators can update participants"
ON public.meeting_participants FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.calendar_events ce WHERE ce.id = event_id AND ce.created_by = auth.uid())
  OR profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  OR is_admin()
);

CREATE POLICY "Event creators can delete participants"
ON public.meeting_participants FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.calendar_events ce
  WHERE ce.id = event_id AND (ce.created_by = auth.uid() OR is_admin())
));

-- Add meeting_link column to calendar_events
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- Add overload_threshold to task_boards 
ALTER TABLE public.task_boards ADD COLUMN IF NOT EXISTS overload_threshold INTEGER NOT NULL DEFAULT 5;
