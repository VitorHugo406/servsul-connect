-- The internal R$ 1,00 test plan ('teste') is active again for webhook tests, but a company can never
-- switch to it from the Pagamentos tab.
CREATE OR REPLACE FUNCTION public.plan_change_blocker(_company_id uuid, _plan_id text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; s record; users_used integer; sectors_used integer; storage_used bigint;
BEGIN
  IF _plan_id = 'teste' THEN RETURN 'Plano indisponível.'; END IF;
  SELECT * INTO p FROM public.subscription_plans WHERE id = _plan_id;
  IF p.id IS NULL THEN RETURN 'Plano inválido.'; END IF;
  SELECT * INTO s FROM public.company_subscriptions WHERE company_id = _company_id;
  SELECT count(*) INTO users_used FROM public.profiles WHERE company_id = _company_id AND is_active AND coalesce(profile_type, 'user') NOT IN ('system', 'bot');
  SELECT count(*) INTO sectors_used FROM public.sectors WHERE company_id = _company_id AND NOT is_general;
  storage_used := public.company_storage_used(_company_id);
  IF users_used > p.max_users + coalesce(s.free_seats, 0) + coalesce(s.extra_users, 0) THEN
    RETURN format('O plano %s permite %s usuários ativos e a empresa tem %s. Desative usuários antes de mudar.', p.name, p.max_users + coalesce(s.free_seats, 0) + coalesce(s.extra_users, 0), users_used);
  END IF;
  IF sectors_used > p.max_sectors THEN
    RETURN format('O plano %s permite %s setores e a empresa tem %s. Exclua setores antes de mudar.', p.name, p.max_sectors, sectors_used);
  END IF;
  IF storage_used > (p.storage_gb + coalesce(s.extra_storage_gb, 0))::bigint * 1024 * 1024 * 1024 THEN
    RETURN format('O plano %s permite %s GB e a empresa usa mais que isso. Libere espaço antes de mudar.', p.name, p.storage_gb + coalesce(s.extra_storage_gb, 0));
  END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.plan_change_blocker(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_change_blocker(uuid, text) TO service_role;
UPDATE public.subscription_plans SET is_active = true WHERE id = 'teste';
