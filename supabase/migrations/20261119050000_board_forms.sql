-- Public form per mural (/f/<token>): anyone with the link fills a form and it becomes a card in the chosen column.
-- The board owner/admin builds it (title, intro, questions, column, priority, due in N days, thank-you text, colour).
-- Questions: [{id, label, type: text|long|email|phone|date|select|number, required, options[]}]; the first question is
-- the card title, the others go to the description. public_form_view/public_form_submit are the only anon entry points:
-- they return/accept only the form itself (never cards, people or company data beyond name/logo/colour).
create table if not exists public.board_forms (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.task_boards(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  enabled boolean not null default true,
  title text not null default 'Formulário',
  intro text,
  questions jsonb not null default '[{"id":"q1","label":"Assunto","type":"text","required":true},{"id":"q2","label":"Descreva o pedido","type":"long","required":false},{"id":"q3","label":"Seu nome","type":"text","required":true},{"id":"q4","label":"Seu e-mail","type":"email","required":true}]'::jsonb,
  column_id uuid references public.task_board_columns(id) on delete set null,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  due_days integer check (due_days is null or due_days between 0 and 365),
  thank_you text,
  color text,
  created_by uuid default public.get_current_profile_id() references public.profiles(id) on delete set null,
  submissions integer not null default 0,
  last_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists board_forms_board on public.board_forms(board_id);
alter table public.board_forms enable row level security;
drop policy if exists "Board admins manage forms" on public.board_forms;
create policy "Board admins manage forms" on public.board_forms for all to authenticated
  using (public.is_board_admin_or_owner(board_id)) with check (public.is_board_admin_or_owner(board_id));

create table if not exists public.board_form_hits (form_id uuid not null references public.board_forms(id) on delete cascade, at timestamptz not null default now());
create index if not exists board_form_hits_form on public.board_form_hits(form_id, at);
alter table public.board_form_hits enable row level security;   -- no policies: only the definer functions touch it

create or replace function public.public_form_view(_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('title', f.title, 'intro', f.intro, 'questions', f.questions, 'thank_you', f.thank_you,
    'color', coalesce(f.color, c.primary_color), 'company', c.name, 'logo', c.logo_url, 'board', b.name)
  from public.board_forms f join public.task_boards b on b.id = f.board_id left join public.companies c on c.id = b.company_id
  where f.token = _token and f.enabled and length(_token) >= 20;
$$;
revoke all on function public.public_form_view(text) from public;
grant execute on function public.public_form_view(text) to anon, authenticated;

create or replace function public.public_form_submit(_token text, _answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare f public.board_forms; b record; col uuid; q jsonb; v text; title text; body text := ''; tid uuid; num int; pos int; due timestamptz;
begin
  select * into f from public.board_forms where token = _token and enabled and length(_token) >= 20;
  if f.id is null then raise exception 'FORM_CLOSED:Este formulário não está disponível.'; end if;
  if jsonb_typeof(_answers) <> 'object' or length(_answers::text) > 20000 then raise exception 'FORM_INVALID:Respostas inválidas.'; end if;
  if coalesce(_answers->>'_hp', '') <> '' then return jsonb_build_object('ok', true); end if;   -- honeypot: bots fill hidden fields
  if (select count(*) from public.board_form_hits h where h.form_id = f.id and h.at > now() - interval '1 minute') >= 20
     or (select count(*) from public.board_form_hits h where h.form_id = f.id and h.at > now() - interval '1 day') >= 1000 then
    raise exception 'FORM_LIMIT:Muitos envios agora. Tente de novo em alguns minutos.';
  end if;
  select tb.id, tb.company_id into b from public.task_boards tb where tb.id = f.board_id;
  for q in select * from jsonb_array_elements(f.questions) loop
    v := left(trim(coalesce(_answers->>(q->>'id'), '')), case when q->>'type' = 'long' then 5000 else 500 end);
    if coalesce((q->>'required')::boolean, false) and v = '' then raise exception 'FORM_REQUIRED:Preencha "%".', q->>'label'; end if;
    if v <> '' and q->>'type' = 'email' and v !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'FORM_EMAIL:E-mail inválido em "%".', q->>'label'; end if;
    if title is null then title := nullif(v, ''); continue; end if;
    if v <> '' then
      body := body || '<p><b>' || replace(replace(q->>'label', '<', '&lt;'), '>', '&gt;') || ':</b> ' || replace(replace(replace(v, '&', '&amp;'), '<', '&lt;'), E'\n', '<br>') || '</p>';
    end if;
  end loop;
  title := left(coalesce(title, f.title), 300);
  body := body || '<p style="color:#888">Recebido pelo formulário "' || replace(f.title, '<', '&lt;') || '" em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '</p>';
  select c.id into col from public.task_board_columns c where c.board_id = f.board_id and (c.id = f.column_id or f.column_id is null)
    order by (c.id = f.column_id) desc, coalesce(c.is_template_column, false), coalesce(c.is_conclusion, false), c.position limit 1;
  if col is null then raise exception 'FORM_CLOSED:Este formulário não está disponível.'; end if;
  select count(*) into pos from public.tasks where board_id = f.board_id and status = col::text;
  if f.due_days is not null then due := (date_trunc('day', now() at time zone 'America/Sao_Paulo') + make_interval(days => f.due_days) + interval '18 hours') at time zone 'America/Sao_Paulo'; end if;
  insert into public.tasks(title, description, status, priority, due_date, board_id, company_id, created_by, position)
    values (title, body, col::text, f.priority, due, f.board_id, b.company_id, coalesce(f.created_by, (select p.id from public.task_boards tb join public.profiles p on p.user_id = tb.owner_id where tb.id = f.board_id limit 1)), pos)
    returning id, task_number into tid, num;
  insert into public.board_form_hits(form_id) values (f.id);
  delete from public.board_form_hits where form_id = f.id and at < now() - interval '2 days';
  update public.board_forms set submissions = submissions + 1, last_at = now() where id = f.id;
  return jsonb_build_object('ok', true, 'number', num);
end $$;
revoke all on function public.public_form_submit(text, jsonb) from public;
grant execute on function public.public_form_submit(text, jsonb) to anon, authenticated;
