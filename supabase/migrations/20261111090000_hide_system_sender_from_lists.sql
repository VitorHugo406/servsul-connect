-- The "Comunicados" system sender lives in the Admin company but must never show up as a user there.
CREATE OR REPLACE FUNCTION public.admin_list_profiles_full()
 RETURNS SETOF profiles LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND can_access_management = true)
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles WHERE company_id = public.current_company_id() AND profile_type <> 'system' ORDER BY name;
END;
$function$;
