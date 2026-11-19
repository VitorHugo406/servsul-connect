-- get_board_tasks_fast also returns tasks.start_date (Linha do tempo). Same body/permissions as before.
drop function if exists public.get_board_tasks_fast(uuid);
create function public.get_board_tasks_fast(_board_id uuid)
returns table(id uuid, task_number integer, title text, description text, status text, priority text, assigned_to uuid, created_by uuid, sector_id uuid, board_id uuid, cover_image text, has_cover boolean, due_date timestamptz, "position" integer, is_archived boolean, is_template boolean, completed_at timestamptz, completed_late boolean, delay_days integer, is_emergency boolean, created_at timestamptz, updated_at timestamptz, assignee jsonb, start_date timestamptz)
language sql stable security definer set search_path = public as $$
 SELECT
   t.id,t.task_number,t.title,t.description,t.status,t.priority,
   t.assigned_to,t.created_by,t.sector_id,t.board_id,
   CASE WHEN t.cover_image LIKE 'data:%' THEN NULL ELSE t.cover_image END,
   COALESCE(t.has_cover,false),t.due_date,t."position",
   COALESCE(t.is_archived,false),COALESCE(t.is_template,false),
   t.completed_at,t.completed_late,t.delay_days,COALESCE(t.is_emergency,false),
   t.created_at,t.updated_at,
   CASE WHEN p.id IS NULL THEN NULL
     ELSE jsonb_build_object('id',p.id,'name',p.name,'display_name',p.display_name,'avatar_url',p.avatar_url)
   END,
   t.start_date
 FROM public.tasks t
 JOIN public.task_boards b ON b.id=t.board_id AND b.company_id=t.company_id
 LEFT JOIN public.profiles p ON p.id=t.assigned_to AND p.company_id=t.company_id
 WHERE t.board_id=_board_id
   AND public.is_board_member(_board_id)
   AND public.same_company(t.company_id)
   AND b.company_id=public.current_company_id()
 ORDER BY t."position" ASC;
$$;
revoke all on function public.get_board_tasks_fast(uuid) from public, anon;
grant execute on function public.get_board_tasks_fast(uuid) to authenticated, service_role;

-- realtime for the mural extras (RLS still applies to what each person receives)
do $$ begin
  begin alter publication supabase_realtime add table public.task_field_values; exception when others then null; end;
  begin alter publication supabase_realtime add table public.task_dependencies; exception when others then null; end;
  begin alter publication supabase_realtime add table public.board_custom_fields; exception when others then null; end;
end $$;
