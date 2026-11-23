-- task_dependencies: the INSERT check looked for the reverse dependency in task_dependencies itself
-- ("not exists (select ... from task_dependencies x ...)"), which made Postgres raise
-- "infinite recursion detected in policy for relation task_dependencies" on every insert — no dependency could be
-- saved (template duplication, Linha do tempo, card dialog). The reverse lookup now runs in a security definer
-- function, outside RLS. Same access as before: board members, both cards on the same mural, no direct cycle.
create or replace function public.task_dep_reverse_exists(_task uuid, _depends_on uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.task_dependencies x where x.task_id = _depends_on and x.depends_on = _task)
$$;
revoke all on function public.task_dep_reverse_exists(uuid, uuid) from public, anon;
grant execute on function public.task_dep_reverse_exists(uuid, uuid) to authenticated;

drop policy if exists "Members use dependencies" on public.task_dependencies;
create policy "Members use dependencies" on public.task_dependencies for all to authenticated
  using (exists (select 1 from public.tasks a join public.tasks b on b.id = depends_on and b.board_id = a.board_id where a.id = task_id and public.is_board_member(a.board_id)))
  with check (exists (select 1 from public.tasks a join public.tasks b on b.id = depends_on and b.board_id = a.board_id where a.id = task_id and public.is_board_member(a.board_id))
    and not public.task_dep_reverse_exists(task_id, depends_on));
