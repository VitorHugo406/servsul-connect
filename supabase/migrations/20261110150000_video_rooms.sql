-- Video calls (Daily.co): the room created for a calendar meeting. The join link only works with a
-- per-person token issued by the `video` edge function to the creator and the invited participants.
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS video_room text;
