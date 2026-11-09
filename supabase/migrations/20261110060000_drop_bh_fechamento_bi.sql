-- The BH, Fechamento and Dash BI shortcuts no longer exist.
ALTER TABLE public.user_permissions DROP COLUMN IF EXISTS can_access_bh, DROP COLUMN IF EXISTS can_access_fechamento;
UPDATE public.companies SET enabled_modules = array_remove(array_remove(array_remove(enabled_modules, 'bh'), 'bi'), 'fechamento')
 WHERE enabled_modules && ARRAY['bh', 'bi', 'fechamento'];
