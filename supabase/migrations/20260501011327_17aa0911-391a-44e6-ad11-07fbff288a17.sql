ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS can_access_bh boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_access_fechamento boolean NOT NULL DEFAULT false;