-- Dash for regular users: released per person in Gerenciamento > Permissões (admins always have it).
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS can_access_dash boolean NOT NULL DEFAULT false;
