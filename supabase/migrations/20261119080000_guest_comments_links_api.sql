-- (1) Guests on the public mural link may comment / approve cards when the owner allows it
--     (board_public_links.allow_comments). guest_comments keeps what guests wrote (shown on /m/<token>); each guest
--     comment is also copied into the card's internal task_comments (author = board owner, prefixed "Convidado") so the
--     team sees it in the card. public_board_view now also returns allow_comments and each card's guest comments.
-- (2) task_links: external links on a card (Drive, OneDrive, Dropbox, Figma, Notion, YouTube, GitHub...).
-- (3) board_inbound_keys.scope: 'create' (default, only creates cards) or 'full' (the cards-in API can also list,
--     read and update the mural's cards).
alter table public.board_public_links add column if not exists allow_comments boolean not null default false;

create table if not exists public.guest_comments (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.board_public_links(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  name text not null,
  text text not null,
  kind text not null default 'comment' check (kind in ('comment', 'approve', 'reject')),
  created_at timestamptz not null default now()
);
create index if not exists guest_comments_task on public.guest_comments(task_id, created_at);
create index if not exists guest_comments_link on public.guest_comments(link_id, created_at);
alter table public.guest_comments enable row level security;
drop policy if exists "Members read guest comments" on public.guest_comments;
create policy "Members read guest comments" on public.guest_comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_board_member(t.board_id)));
drop policy if exists "Board admins delete guest comments" on public.guest_comments;
create policy "Board admins delete guest comments" on public.guest_comments for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_board_admin_or_owner(t.board_id)));

create or replace function public.public_board_comment(_token text, _task uuid, _name text, _text text, _kind text default 'comment')
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record; t record; owner uuid; nm text := left(trim(coalesce(_name, '')), 60); tx text := left(trim(coalesce(_text, '')), 2000); k text := coalesce(_kind, 'comment');
begin
  select bl.id, bl.board_id into l from public.board_public_links bl where bl.token = _token and bl.enabled and bl.allow_comments and length(_token) >= 20;
  if l.id is null then raise exception 'GUEST_CLOSED:Comentários não estão liberados neste link.'; end if;
  if k not in ('comment', 'approve', 'reject') then k := 'comment'; end if;
  if nm = '' then raise exception 'GUEST_NAME:Informe seu nome.'; end if;
  if k = 'comment' and tx = '' then raise exception 'GUEST_TEXT:Escreva o comentário.'; end if;
  if (select count(*) from public.guest_comments g where g.link_id = l.id and g.created_at > now() - interval '1 minute') >= 15
     or (select count(*) from public.guest_comments g where g.link_id = l.id and g.created_at > now() - interval '1 day') >= 500 then
    raise exception 'GUEST_LIMIT:Muitos comentários agora. Tente de novo em alguns minutos.';
  end if;
  select id, board_id, company_id into t from public.tasks where id = _task and board_id = l.board_id and not coalesce(is_archived, false) and not coalesce(is_template, false);
  if t.id is null then raise exception 'GUEST_CARD:Card não encontrado.'; end if;
  insert into public.guest_comments(link_id, task_id, name, text, kind) values (l.id, t.id, nm, tx, k);
  select p.id into owner from public.task_boards b join public.profiles p on p.user_id = b.owner_id where b.id = l.board_id limit 1;
  if owner is not null then
    insert into public.task_comments(task_id, author_id, content)
    values (t.id, owner, case k when 'approve' then '✅ Convidado ' || nm || ' aprovou este card' when 'reject' then '⛔ Convidado ' || nm || ' pediu ajustes' else '💬 Convidado ' || nm end
      || case when tx <> '' then ': ' || tx else '' end);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.public_board_comment(text, uuid, text, text, text) from public;
grant execute on function public.public_board_comment(text, uuid, text, text, text) to anon, authenticated;

create table if not exists public.task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  url text not null check (url ~* '^https?://[^\s]+$' and length(url) <= 2000),
  title text,
  created_by uuid default public.get_current_profile_id() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists task_links_task on public.task_links(task_id);
alter table public.task_links enable row level security;
drop policy if exists "Members use task links" on public.task_links;
create policy "Members use task links" on public.task_links for all to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_board_member(t.board_id)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.is_board_member(t.board_id)));

alter table public.board_inbound_keys add column if not exists scope text not null default 'create';
alter table public.board_inbound_keys drop constraint if exists board_inbound_keys_scope_check;
alter table public.board_inbound_keys add constraint board_inbound_keys_scope_check check (scope in ('create', 'full'));

-- public_board_view: + allow_comments and each card's guest comments of THIS link (last 30)
create or replace function public.public_board_view(_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b record; res jsonb;
begin
  if _token is null or length(_token) < 20 then return null; end if;
  select tb.id, tb.name, tb.description, tb.background_image, c.name as company, l.id as link_id, l.allow_comments
    into b from board_public_links l join task_boards tb on tb.id = l.board_id left join companies c on c.id = tb.company_id
    where l.token = _token and l.enabled limit 1;
  if b.id is null then return null; end if;
  select jsonb_build_object(
    'name', b.name, 'description', b.description, 'company', b.company, 'allow_comments', b.allow_comments,
    'background', case when b.background_image like 'cover-%' or b.background_image like '/covers/%' then b.background_image else null end,
    'columns', coalesce((select jsonb_agg(jsonb_build_object('id', col.id, 'title', col.title, 'color', col.color, 'done', col.is_conclusion) order by col.position)
                from task_board_columns col where col.board_id = b.id and not coalesce(col.is_template_column, false)), '[]'::jsonb),
    'cards', coalesce((select jsonb_agg(jsonb_build_object(
                'id', t.id, 'n', t.task_number, 'title', t.title, 'col', t.status, 'due', t.due_date, 'priority', t.priority,
                'done', t.completed_at is not null,
                'labels', coalesce((select jsonb_agg(jsonb_build_object('name', lb.name, 'color', lb.color)) from task_label_assignments la join task_labels lb on lb.id = la.label_id where la.task_id = t.id), '[]'::jsonb),
                'check', (select jsonb_build_array(count(*) filter (where s.is_completed), count(*)) from task_subtasks s where s.task_id = t.id),
                'guest', coalesce((select jsonb_agg(jsonb_build_object('name', g.name, 'text', g.text, 'kind', g.kind, 'at', g.created_at) order by g.created_at)
                          from (select * from guest_comments g0 where g0.task_id = t.id and g0.link_id = b.link_id order by g0.created_at desc limit 30) g), '[]'::jsonb)
              ) order by t.position)
              from tasks t where t.board_id = b.id and not coalesce(t.is_archived, false) and not coalesce(t.is_template, false)), '[]'::jsonb),
    'updated_at', now()) into res;
  return res;
end $$;
revoke all on function public.public_board_view(text) from public;
grant execute on function public.public_board_view(text) to anon, authenticated;
