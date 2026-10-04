ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS team_alert_times text[] DEFAULT ARRAY['09:00'];

-- Update existing profiles to have the default
UPDATE public.profiles SET team_alert_times = ARRAY['09:00'] WHERE team_alert_times IS NULL;
