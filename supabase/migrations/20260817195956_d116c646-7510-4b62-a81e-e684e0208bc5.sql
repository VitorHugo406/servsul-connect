CREATE INDEX IF NOT EXISTS idx_workload_alerts_dedup_task
ON public.workload_alerts (profile_id, alert_type, task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workload_alerts_dedup_without_task
ON public.workload_alerts (profile_id, alert_type, created_at DESC)
WHERE task_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_workload_alerts_profile_created
ON public.workload_alerts (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_companies_active_normalized_name
ON public.companies (lower(btrim(name)))
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_companies_active_normalized_slug
ON public.companies (lower(btrim(slug)))
WHERE is_active = true;

DELETE FROM public.workload_alerts
WHERE created_at < now() - interval '90 days';

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY profile_id, alert_type, task_id, date_trunc('hour', created_at)
           ORDER BY created_at DESC, id DESC
         ) AS duplicate_rank
  FROM public.workload_alerts
)
DELETE FROM public.workload_alerts w
USING ranked r
WHERE w.id = r.id
  AND r.duplicate_rank > 1;

ANALYZE public.workload_alerts;
ANALYZE public.companies;
ANALYZE public.tasks;