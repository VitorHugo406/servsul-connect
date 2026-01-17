-- Update announcements RLS policy to use can_post_announcements permission
DROP POLICY IF EXISTS "Gerentes e admins podem criar avisos" ON public.announcements;

CREATE POLICY "Usuários com permissão podem criar avisos"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = public.get_current_profile_id() AND
    (
      public.has_autonomy_level('gerente') OR
      EXISTS (
        SELECT 1 FROM public.user_permissions 
        WHERE user_id = auth.uid() 
        AND can_post_announcements = true
      )
    )
  );

-- Create direct_messages table for individual conversations
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on direct_messages
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for direct messages
CREATE POLICY "Users can view their own direct messages"
  ON public.direct_messages FOR SELECT
  TO authenticated
  USING (
    sender_id = public.get_current_profile_id() OR 
    receiver_id = public.get_current_profile_id()
  );

CREATE POLICY "Users can send direct messages"
  ON public.direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = public.get_current_profile_id());

CREATE POLICY "Users can delete their own sent messages"
  ON public.direct_messages FOR DELETE
  TO authenticated
  USING (sender_id = public.get_current_profile_id() OR is_admin());

-- Create user_notifications table for chatbot notifications
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'announcement', 'message', 'birthday', 'system'
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  reference_id uuid, -- ID of related entity (announcement_id, message_id, etc.)
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on user_notifications
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.user_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.user_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.user_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime for direct_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;