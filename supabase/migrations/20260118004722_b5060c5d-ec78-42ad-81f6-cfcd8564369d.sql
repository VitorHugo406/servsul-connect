-- 1. Add user_status column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_status text DEFAULT 'available';

-- 2. Add work_period column to profiles (turno/período)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_period text;

-- 3. Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Create attachments table for messages and announcements
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  file_url text NOT NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  direct_message_id uuid REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on attachments
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Attachments policies
CREATE POLICY "Users can view attachments in messages they can see"
  ON public.attachments FOR SELECT
  USING (
    (message_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.messages m WHERE m.id = message_id
    )) OR
    (direct_message_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.direct_messages dm WHERE dm.id = direct_message_id AND (dm.sender_id = get_current_profile_id() OR dm.receiver_id = get_current_profile_id())
    )) OR
    (announcement_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.announcements a WHERE a.id = announcement_id
    ))
  );

CREATE POLICY "Users can upload attachments"
  ON public.attachments FOR INSERT
  WITH CHECK (uploaded_by = get_current_profile_id());

CREATE POLICY "Users can delete own attachments"
  ON public.attachments FOR DELETE
  USING (uploaded_by = get_current_profile_id() OR is_admin());

-- 6. Create user_presence table for online/offline tracking
CREATE TABLE IF NOT EXISTS public.user_presence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  is_online boolean NOT NULL DEFAULT false,
  last_heartbeat timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on user_presence
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Presence policies
CREATE POLICY "Everyone can view presence"
  ON public.user_presence FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own presence"
  ON public.user_presence FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own presence"
  ON public.user_presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Enable realtime for user_presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

-- 7. Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 8. Storage policies for attachments
CREATE POLICY "Attachments are publicly accessible for viewing"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments');

CREATE POLICY "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 9. Add is_read tracking for announcements per user
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Enable RLS on announcement_reads
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- Announcement reads policies
CREATE POLICY "Users can view their own announcement reads"
  ON public.announcement_reads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can mark announcements as read"
  ON public.announcement_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 10. Update is_read policy for direct_messages - allow receiver to update is_read
DROP POLICY IF EXISTS "Users can update read status" ON public.direct_messages;
CREATE POLICY "Users can update read status of their received messages"
  ON public.direct_messages FOR UPDATE
  USING (receiver_id = get_current_profile_id())
  WITH CHECK (receiver_id = get_current_profile_id());

-- 11. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON public.attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_direct_message_id ON public.attachments(direct_message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_announcement_id ON public.attachments(announcement_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON public.user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_id ON public.announcement_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_status ON public.profiles(user_status);
CREATE INDEX IF NOT EXISTS idx_profiles_birth_date ON public.profiles(birth_date);

-- Enable realtime for direct_messages if not already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'direct_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;
END
$$;

-- Enable realtime for announcement_reads
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_reads;