-- Outgoing webhooks for tasks (Zapier, Make, n8n, the company's own systems). The company admin registers an https URL
-- and the events; every matching change on a card POSTs JSON signed with HMAC-SHA256 (header X-Ewvon-Signature:
-- sha256=<hex of hmac(body, secret)>). Events: task.created, task.moved (column changed), task.completed.
create table if not exists public.company_webhooks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  url text not null check (url ~ '^https://[a-zA-Z0-9.-]+(:443)?(/.*)?$' and url !~* '^https://(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.|0\.|\[)'),
  events text[] not null default array['task.created','task.moved','task.completed'],
  secret text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  enabled boolean not null default true,
  description text,
  last_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists company_webhooks_company on public.company_webhooks(company_id) where enabled;
alter table public.company_webhooks enable row level security;
drop policy if exists "Company admins manage webhooks" on public.company_webhooks;
create policy "Company admins manage webhooks" on public.company_webhooks for all to authenticated
  using (company_id = public.current_company_id() and public.is_admin())
  with check (company_id = public.current_company_id() and public.is_admin());

create or replace function public.ewvon_webhook_post(_hook public.company_webhooks, _event text, _data jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare body text;
begin
  body := jsonb_build_object('event', _event, 'sent_at', now(), 'company_id', _hook.company_id, 'data', _data)::text;
  perform net.http_post(
    url := _hook.url, body := body::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'User-Agent', 'ewvon-webhooks/1', 'X-Ewvon-Event', _event,
      'X-Ewvon-Signature', 'sha256=' || encode(extensions.hmac(body, _hook.secret, 'sha256'), 'hex')),
    timeout_milliseconds := 8000);
  update public.company_webhooks set last_at = now() where id = _hook.id;
end $$;
revoke all on function public.ewvon_webhook_post(public.company_webhooks, text, jsonb) from public, anon, authenticated;

create or replace function public.tasks_webhook_trigger()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare ev text; h public.company_webhooks; d jsonb;
begin
  if coalesce(new.is_template, false) then return new; end if;
  if tg_op = 'INSERT' then ev := 'task.created';
  elsif new.completed_at is not null and old.completed_at is null then ev := 'task.completed';
  elsif new.status is distinct from old.status then ev := 'task.moved';
  else return new; end if;
  if not exists (select 1 from public.company_webhooks w where w.company_id = new.company_id and w.enabled and ev = any(w.events)) then return new; end if;
  select jsonb_build_object('task', jsonb_build_object(
      'id', new.id, 'number', new.task_number, 'title', new.title, 'priority', new.priority, 'due_date', new.due_date,
      'completed_at', new.completed_at, 'completed_late', new.completed_late,
      'board', jsonb_build_object('id', b.id, 'name', b.name),
      'column', jsonb_build_object('id', c.id, 'title', c.title),
      'assignee', case when p.id is null then null else jsonb_build_object('id', p.id, 'name', coalesce(p.display_name, p.name)) end,
      'url', 'https://ewvon.com/tarefas?board=' || new.board_id || '&task=' || new.id),
    'previous_column', case when tg_op = 'UPDATE' and new.status is distinct from old.status then (select jsonb_build_object('id', oc.id, 'title', oc.title) from public.task_board_columns oc where oc.id::text = old.status) end)
    into d
    from (select 1) x left join public.task_boards b on b.id = new.board_id left join public.task_board_columns c on c.id::text = new.status left join public.profiles p on p.id = new.assigned_to;
  for h in select * from public.company_webhooks w where w.company_id = new.company_id and w.enabled and ev = any(w.events) loop
    begin perform public.ewvon_webhook_post(h, ev, d); exception when others then null; end;   -- never block the card change
  end loop;
  return new;
end $$;
drop trigger if exists tasks_webhook on public.tasks;
create trigger tasks_webhook after insert or update of status, completed_at on public.tasks for each row execute function public.tasks_webhook_trigger();

-- "Enviar teste" button: a sample event to one webhook of the caller's company.
create or replace function public.send_test_webhook(_id uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare h public.company_webhooks;
begin
  if not public.is_admin() then return false; end if;
  select * into h from public.company_webhooks where id = _id and company_id = public.current_company_id();
  if h.id is null then return false; end if;
  perform public.ewvon_webhook_post(h, 'test', jsonb_build_object('message', 'Teste do ewvon: o webhook está funcionando.'));
  return true;
end $$;
revoke all on function public.send_test_webhook(uuid) from public, anon;
grant execute on function public.send_test_webhook(uuid) to authenticated;
