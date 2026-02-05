-- Create table for important announcements (comunicados importantes)
CREATE TABLE public.important_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  border_style TEXT NOT NULL DEFAULT 'gradient-blue',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  start_at TIMESTAMP WITH TIME ZONE,
  expire_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create table to track which users have seen the announcement
CREATE TABLE public.important_announcement_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.important_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Enable RLS
ALTER TABLE public.important_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.important_announcement_reads ENABLE ROW LEVEL SECURITY;

-- RLS policies for important_announcements
-- All authenticated users can view active announcements
CREATE POLICY "Anyone can view active important announcements"
ON public.important_announcements
FOR SELECT
TO authenticated
USING (is_active = true);

-- Only admins can create/update/delete
CREATE POLICY "Admins can manage important announcements"
ON public.important_announcements
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- RLS policies for important_announcement_reads
-- Users can view their own reads
CREATE POLICY "Users can view own announcement reads"
ON public.important_announcement_reads
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can mark announcements as read
CREATE POLICY "Users can mark announcements as read"
ON public.important_announcement_reads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for important_announcements
ALTER PUBLICATION supabase_realtime ADD TABLE public.important_announcements;