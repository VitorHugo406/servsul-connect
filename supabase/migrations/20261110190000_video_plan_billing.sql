-- Video calls: Empresarial plan only, 2,500 free participant-minutes per company per month, then
-- (if the company admin opts in) billed on the next invoice at billing_settings.video_price_per_minute.
ALTER TABLE public.billing_settings
  ADD COLUMN IF NOT EXISTS video_free_minutes integer NOT NULL DEFAULT 2500,
  ADD COLUMN IF NOT EXISTS video_price_per_minute numeric(10,4) NOT NULL DEFAULT 0.045;   -- R$ per participant-minute (2x Daily)
ALTER TABLE public.company_subscriptions ADD COLUMN IF NOT EXISTS video_overage_allowed boolean NOT NULL DEFAULT false;

UPDATE public.subscription_plans SET features = array_append(features, 'video_calls')
 WHERE id = 'empresarial' AND NOT ('video_calls' = ANY (features));

-- Every Daily room the ewvon created, so usage can be attributed to a company.
CREATE TABLE IF NOT EXISTS public.video_rooms (
  name text PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('meeting', 'chat')),
  ref text NOT NULL,                 -- meeting: calendar event id; chat: dm:<a>:<b> | group:<id> | sector:<id>
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz
);
ALTER TABLE public.video_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.video_rooms FROM anon, authenticated;
INSERT INTO public.video_rooms (name, company_id, kind, ref)
SELECT video_room, company_id, 'meeting', id::text FROM public.calendar_events WHERE video_room IS NOT NULL
ON CONFLICT DO NOTHING;

-- Participant-minutes per company per month (UTC), refreshed from Daily by the `video` function.
CREATE TABLE IF NOT EXISTS public.company_video_usage (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  month text NOT NULL,
  minutes integer NOT NULL DEFAULT 0,
  overage_minutes integer NOT NULL DEFAULT 0,
  overage_cents integer NOT NULL DEFAULT 0,
  alerted_80 boolean NOT NULL DEFAULT false, alerted_90 boolean NOT NULL DEFAULT false, alerted_100 boolean NOT NULL DEFAULT false,
  billed_at timestamptz, billed_payment_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, month)
);
ALTER TABLE public.company_video_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company admins read video usage" ON public.company_video_usage;
CREATE POLICY "Company admins read video usage" ON public.company_video_usage FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (company_id = public.current_company_id() AND public.is_admin()));
REVOKE ALL ON public.company_video_usage FROM anon, authenticated;
GRANT SELECT ON public.company_video_usage TO authenticated;

-- What the company admin sees in Pagamentos.
CREATE OR REPLACE FUNCTION public.my_video_usage()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'month', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'),
    'minutes', coalesce((SELECT minutes FROM public.company_video_usage WHERE company_id = public.current_company_id() AND month = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM')), 0),
    'free_minutes', (SELECT video_free_minutes FROM public.billing_settings LIMIT 1),
    'price_per_minute', (SELECT video_price_per_minute FROM public.billing_settings LIMIT 1),
    'overage_allowed', coalesce((SELECT video_overage_allowed FROM public.company_subscriptions WHERE company_id = public.current_company_id()), false),
    'pending_cents', coalesce((SELECT sum(overage_cents) FROM public.company_video_usage WHERE company_id = public.current_company_id() AND billed_at IS NULL), 0))
$$;
REVOKE EXECUTE ON FUNCTION public.my_video_usage() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_video_usage() TO authenticated;

-- Company admin: allow (or stop) paid minutes beyond the free allowance.
CREATE OR REPLACE FUNCTION public.set_video_overage(_allowed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.company_subscriptions SET video_overage_allowed = _allowed WHERE company_id = public.current_company_id();
END $$;
REVOKE EXECUTE ON FUNCTION public.set_video_overage(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_video_overage(boolean) TO authenticated;
