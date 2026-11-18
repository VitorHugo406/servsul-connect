-- Super admin can release any storage size to a company (manual release of the free test sign-ups).
-- When set, it replaces plan + paid extras; it is never charged (billing only reads extra_storage_gb).
alter table public.company_subscriptions add column if not exists storage_gb_override integer;
alter table public.company_subscriptions drop constraint if exists company_subscriptions_storage_override_ok;
alter table public.company_subscriptions add constraint company_subscriptions_storage_override_ok
  check (storage_gb_override is null or storage_gb_override between 1 and 100000);

create or replace function public.company_limits(_company_id uuid)
returns table(max_users integer, max_sectors integer, storage_bytes bigint)
language sql stable security definer set search_path = public as $function$
  SELECT
    CASE WHEN unlimited THEN NULL ELSE p.max_users + s.free_seats + s.extra_users END,
    CASE WHEN unlimited THEN NULL ELSE p.max_sectors END,
    CASE WHEN unlimited THEN NULL ELSE coalesce(s.storage_gb_override, p.storage_gb + s.extra_storage_gb)::bigint * 1024 * 1024 * 1024 END
  FROM (SELECT 1) one
  LEFT JOIN public.company_subscriptions s ON s.company_id = _company_id
  LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
  CROSS JOIN LATERAL (SELECT (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = _company_id AND c.is_system)
                              OR s.status IS NULL OR s.status = 'exempt' OR p.id IS NULL) AS unlimited) u
$function$;
