-- Responsáveis por departamento: each label of a mural may point to a default person (task_labels.default_assignee).
-- When the template column has template_auto_assign = true, "Duplicar todos os cards" fills the responsible of each
-- new card from the first of its labels that has a default person. Off = manual adjustment.
alter table public.task_labels add column if not exists default_assignee uuid references public.profiles(id) on delete set null;
alter table public.task_board_columns add column if not exists template_auto_assign boolean not null default false;

-- the default person must belong to the mural's company
create or replace function public.task_label_assignee_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.default_assignee is not null and not exists (
    select 1 from public.profiles p join public.task_boards b on b.id = new.board_id
    where p.id = new.default_assignee and p.company_id = b.company_id
  ) then
    raise exception 'ETIQUETA_RESPONSAVEL: a pessoa precisa ser da mesma empresa do mural';
  end if;
  return new;
end $$;

drop trigger if exists task_label_assignee_guard on public.task_labels;
create trigger task_label_assignee_guard before insert or update of default_assignee on public.task_labels
  for each row execute function public.task_label_assignee_guard();
