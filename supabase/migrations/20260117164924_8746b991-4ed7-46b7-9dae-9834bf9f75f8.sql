-- Add start_at and expire_at columns to announcements
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS start_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS expire_at TIMESTAMP WITH TIME ZONE;

-- Add last_seen_at to profiles for tracking last activity
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;

-- Create user_additional_sectors table if not exists (fix for additional sectors)
-- This table should already exist but let's ensure it's properly configured

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_user_additional_sectors_user_id ON public.user_additional_sectors(user_id);
CREATE INDEX IF NOT EXISTS idx_user_additional_sectors_sector_id ON public.user_additional_sectors(sector_id);

-- Add foreign key constraints if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_additional_sectors_sector_id_fkey'
  ) THEN
    ALTER TABLE public.user_additional_sectors 
    ADD CONSTRAINT user_additional_sectors_sector_id_fkey 
    FOREIGN KEY (sector_id) REFERENCES public.sectors(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update messages RLS to allow sending to additional sectors
DROP POLICY IF EXISTS "Usuários podem criar mensagens no seu setor ou Geral" ON public.messages;

CREATE POLICY "Usuários podem criar mensagens nos setores com acesso" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  author_id = get_current_profile_id() AND (
    sector_id = get_current_sector_id() OR 
    sector_id = '00000000-0000-0000-0000-000000000001'::uuid OR
    is_admin() OR
    EXISTS (
      SELECT 1 FROM public.user_additional_sectors 
      WHERE user_id = auth.uid() AND sector_id = messages.sector_id
    )
  )
);

-- Update messages SELECT policy to include additional sectors
DROP POLICY IF EXISTS "Usuários podem ver mensagens do seu setor ou Geral" ON public.messages;

CREATE POLICY "Usuários podem ver mensagens dos setores com acesso" 
ON public.messages 
FOR SELECT 
USING (
  sector_id = get_current_sector_id() OR 
  sector_id = '00000000-0000-0000-0000-000000000001'::uuid OR 
  is_admin() OR
  EXISTS (
    SELECT 1 FROM public.user_additional_sectors 
    WHERE user_id = auth.uid() AND sector_id = messages.sector_id
  )
);

-- Ensure direct_messages privacy - admins CANNOT see others' messages
DROP POLICY IF EXISTS "Users can view their own direct messages" ON public.direct_messages;

CREATE POLICY "Users can only view their own direct messages" 
ON public.direct_messages 
FOR SELECT 
USING (
  sender_id = get_current_profile_id() OR 
  receiver_id = get_current_profile_id()
);

-- Note: Even admins should not see private messages that don't involve them

-- Create function to update last_seen_at
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles 
  SET last_seen_at = now() 
  WHERE user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;