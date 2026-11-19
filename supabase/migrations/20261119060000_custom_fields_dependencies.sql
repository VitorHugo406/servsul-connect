-- Custom fields per mural, card dependencies and a start date for the timeline (Gantt).
--  board_custom_fields: fields a mural defines (text, number, money, date, select, checkbox), managed by the board
--    owner/admin, readable by board members. task_field_values: one JSON value per card × field, written by members.
--  task_dependencies: "task_id is blocked by depends_on" (same mural, no self link, no direct cycle). A card cannot be
--    concluded (completed_at set or moved into a conclusion column) while a card it depends on is open: the trigger
--    raises CARD_BLOCKED:<message>.
--  tasks.start_date: optional start for the timeline bar (end = due_date).
create table if not exists public.board_custom_fields (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.task_boards(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  type text not null check (type in ('text','number','money','date','select','checkbox')),
  options jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  show_on_card boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists board_custom_fields_board on public.board_custom_fields(board_id, position);
alter table public.board_custom_fields enable row level security;
drop policy if exists "Members read fields" on public.board_custom_fields;
create policy "Members read fields" on public.board_custom_fields for select to authenticated using (public.is_board_member(board_id));
drop policy if exists "Board admins manage fields" on public.board_custom_fields;
create policy "Board admins manage fields" on public.board_custom_fields for all to authenticated
  using (public.is_board_admin_or_owner(board_id)) with check (public.is_board_admin_or_owner(board_id));

create table if not exists public.task_field_values (
  task_id uuid not null references public.tasks(id) on delete cascade,
  field_id uuid not null references public.board_custom_fields(id) on delete cascade,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (task_id, field_id)
);
create index if not exists task_field_values_field on public.task_field_values(field_id);
alter table public.task_field_values enable row level security;
drop policy if exists "Members use field values" on public.task_field_values;
create policy "Members use field values" on public.task_field_values for all to authenticated
  using (exists (select 1 from public.tasks t join public.board_custom_fields f on f.id = field_id and f.board_id = t.board_id where t.id = task_id and public.is_board_member(t.board_id)))
  with check (exists (select 1 from public.tasks t join public.board_custom_fields f on f.id = field_id and f.board_id = t.board_id where t.id = task_id and public.is_board_member(t.board_id)));

create table if not exists public.task_dependencies (
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on uuid not null references public.tasks(id) on delete cascade,
  created_by uuid default public.get_current_profile_id(),
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on),
  check (task_id <> depends_on)
);
create index if not exists task_dependencies_dep on public.task_dependencies(depends_on);
alter table public.task_dependencies enable row level security;
drop policy if exists "Members use dependencies" on public.task_dependencies;
create policy "Members use dependencies" on public.task_dependencies for all to authenticated
  using (exists (select 1 from public.tasks a join public.tasks b on b.id = depends_on and b.board_id = a.board_id where a.id = task_id and public.is_board_member(a.board_id)))
  with check (exists (select 1 from public.tasks a join public.tasks b on b.id = depends_on and b.board_id = a.board_id where a.id = task_id and public.is_board_member(a.board_id))
    and not exists (select 1 from public.task_dependencies x where x.task_id = depends_on and x.depends_on = task_id));

alter table public.tasks add column if not exists start_date timestamptz;

create or replace function public.tasks_dependency_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare concl boolean; blocker record;
begin
  if coalesce(new.is_template, false) or coalesce(current_setting('ewvon.wr_sync', true), '') = '1' then return new; end if;   -- War Room sync closes its own card
  select coalesce(c.is_conclusion, false) into concl from public.task_board_columns c where c.id::text = new.status;
  if not ((new.completed_at is not null and old.completed_at is null) or (coalesce(concl, false) and new.status is distinct from old.status)) then return new; end if;
  select b.task_number, b.title into blocker from public.task_dependencies d join public.tasks b on b.id = d.depends_on
    left join public.task_board_columns bc on bc.id::text = b.status
    where d.task_id = new.id and b.completed_at is null and not coalesce(bc.is_conclusion, false) and not coalesce(b.is_archived, false) limit 1;
  if blocker.title is not null then
    raise exception 'CARD_BLOCKED:Este card depende do card #% "%", que ainda não foi concluído.', coalesce(blocker.task_number::text, '?'), left(blocker.title, 80);
  end if;
  return new;
end $$;
drop trigger if exists tasks_dependency_guard on public.tasks;
create trigger tasks_dependency_guard before update of status, completed_at on public.tasks for each row execute function public.tasks_dependency_guard();
