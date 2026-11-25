-- Responsáveis por departamento: a whole sector can be picked for a label; everyone in it (main or additional sector,
-- resolved at duplication time) joins the card as co-responsável (the first person picked by name stays responsável).
alter table public.task_labels add column if not exists default_sectors uuid[] not null default '{}';

create or replace function public.task_label_assignee_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.default_assignee is not null and not exists (
        select 1 from public.profiles p join public.task_boards b on b.id = new.board_id
        where p.id = new.default_assignee and p.company_id = b.company_id))
     or exists (
        select 1 from unnest(coalesce(new.default_assignees, '{}')) x(pid)
        where not exists (select 1 from public.profiles p join public.task_boards b on b.id = new.board_id
                          where p.id = x.pid and p.company_id = b.company_id))
     or exists (
        select 1 from unnest(coalesce(new.default_sectors, '{}')) x(sid)
        where not exists (select 1 from public.sectors s join public.task_boards b on b.id = new.board_id
                          where s.id = x.sid and s.company_id = b.company_id)) then
    raise exception 'ETIQUETA_RESPONSAVEL: a pessoa ou o setor precisa ser da mesma empresa do mural';
  end if;
  if cardinality(coalesce(new.default_assignees, '{}')) > 20 or cardinality(coalesce(new.default_sectors, '{}')) > 20 then
    raise exception 'ETIQUETA_RESPONSAVEL: no máximo 20 pessoas e 20 setores por etiqueta';
  end if;
  return new;
end $$;

drop trigger if exists task_label_assignee_guard on public.task_labels;
create trigger task_label_assignee_guard before insert or update of default_assignee, default_assignees, default_sectors on public.task_labels
  for each row execute function public.task_label_assignee_guard();
