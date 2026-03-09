
-- Add reply_to support for messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

-- Create message reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, profile_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reactions" ON public.message_reactions FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can add own reactions" ON public.message_reactions FOR INSERT 
WITH CHECK (profile_id = public.get_current_profile_id());

CREATE POLICY "Users can remove own reactions" ON public.message_reactions FOR DELETE 
USING (profile_id = public.get_current_profile_id());

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- Add task_id to war_room_timeline for emergency card links
ALTER TABLE public.war_room_timeline 
ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
