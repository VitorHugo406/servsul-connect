-- Read-only public link of a mural (external guests: clients, suppliers). Only the board owner/admin creates or
-- disables it; anyone with the token sees columns and cards (title, column, due date, priority, labels, checklist
-- progress, completion) through public_board_view() — no descriptions, comments, attachments, people or e-mails.
create table if not exists public.board_public_links (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.task_boards(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  enabled boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists board_public_links_board on public.board_public_links(board_id);
alter table public.board_public_links enable row level security;

drop policy if exists "Board admins manage public links" on public.board_public_links;
create policy "Board admins manage public links" on public.board_public_links
  for all to authenticated
  using (public.is_board_admin_or_owner(board_id))
  with check (public.is_board_admin_or_owner(board_id));

create or replace function public.public_board_view(_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b record; res jsonb;
begin
  if _token is null or length(_token) < 20 then return null; end if;
  select tb.id, tb.name, tb.description, tb.background_image, c.name as company
    into b from board_public_links l join task_boards tb on tb.id = l.board_id left join companies c on c.id = tb.company_id
    where l.token = _token and l.enabled limit 1;
  if b.id is null then return null; end if;
  select jsonb_build_object(
    'name', b.name, 'description', b.description, 'company', b.company,
    'background', case when b.background_image like 'cover-%' or b.background_image like '/covers/%' then b.background_image else null end,
    'columns', coalesce((select jsonb_agg(jsonb_build_object('id', col.id, 'title', col.title, 'color', col.color, 'done', col.is_conclusion) order by col.position)
                from task_board_columns col where col.board_id = b.id and not coalesce(col.is_template_column, false)), '[]'::jsonb),
    'cards', coalesce((select jsonb_agg(jsonb_build_object(
                'id', t.id, 'n', t.task_number, 'title', t.title, 'col', t.status, 'due', t.due_date, 'priority', t.priority,
                'done', t.completed_at is not null,
                'labels', coalesce((select jsonb_agg(jsonb_build_object('name', lb.name, 'color', lb.color)) from task_label_assignments la join task_labels lb on lb.id = la.label_id where la.task_id = t.id), '[]'::jsonb),
                'check', (select jsonb_build_array(count(*) filter (where s.is_completed), count(*)) from task_subtasks s where s.task_id = t.id)
              ) order by t.position)
              from tasks t where t.board_id = b.id and not coalesce(t.is_archived, false) and not coalesce(t.is_template, false)), '[]'::jsonb),
    'updated_at', now()) into res;
  return res;
end $$;
revoke all on function public.public_board_view(text) from public;
grant execute on function public.public_board_view(text) to anon, authenticated;
