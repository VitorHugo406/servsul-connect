// Profile columns any colleague may read. CPF, address and registration number are private:
// only the person (get_my_full_profile) and admins (admin_list_profiles_full) see them.
// Keep in sync with migration 20261109110000_security_hardening.sql (column grants).
export const PUBLIC_PROFILE_COLUMNS: string = 'id,user_id,name,display_name,email,avatar_url,cover_url,sector_id,autonomy_level,birth_date,created_at,updated_at,phone,profile_type,is_active,last_seen_at,user_status,work_period,company_id,description,team_alert_times,team_alerts_enabled,company,work_start,work_end,work_days,status_until';
