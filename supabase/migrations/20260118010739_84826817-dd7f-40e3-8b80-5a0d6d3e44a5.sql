
-- Add unique constraint on announcement_reads for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'announcement_reads_user_announcement_unique'
  ) THEN
    ALTER TABLE public.announcement_reads ADD CONSTRAINT announcement_reads_user_announcement_unique UNIQUE (user_id, announcement_id);
  END IF;
END $$;

-- Create index for faster queries on birth_date for birthdays
CREATE INDEX IF NOT EXISTS idx_profiles_birth_date ON public.profiles (birth_date);

-- Create function to check if user is active (for use in auth)
CREATE OR REPLACE FUNCTION public.check_user_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
    false
  );
$$;
