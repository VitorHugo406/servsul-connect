-- Assinaturas de e-mail: visuais (modelos) da empresa + a assinatura de cada pessoa.
--  * user_permissions.can_manage_signatures: quem cadastra/edita/exclui visuais (admins sempre podem).
--  * email_signature_templates: um visual = nome + config jsonb (posição da logo, estilo, cores, campos...).
--  * email_signature_prefs: o visual escolhido pela pessoa e os dados que ela mostra (cargo, telefones...).
--  * Logos dos visuais: bucket público company-logos, pasta signatures/<empresa>/, porque o e-mail de quem recebe
--    precisa abrir a imagem sem login.
alter table public.user_permissions add column if not exists can_manage_signatures boolean not null default false;

create or replace function public.can_manage_signatures()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (public.is_admin()
    or exists (select 1 from public.user_permissions p where p.user_id = auth.uid() and p.can_manage_signatures))
$$;
grant execute on function public.can_manage_signatures() to authenticated;

create table if not exists public.email_signature_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object' and length(config::text) <= 20000),
  is_default boolean not null default false,
  created_by uuid default public.get_current_profile_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists email_signature_templates_company on public.email_signature_templates(company_id, name);
create unique index if not exists email_signature_templates_one_default on public.email_signature_templates(company_id) where is_default;
alter table public.email_signature_templates enable row level security;
drop policy if exists "Company sees signature visuals" on public.email_signature_templates;
create policy "Company sees signature visuals" on public.email_signature_templates for select to authenticated
  using (public.same_company(company_id));
drop policy if exists "Managers create signature visuals" on public.email_signature_templates;
create policy "Managers create signature visuals" on public.email_signature_templates for insert to authenticated
  with check (public.same_company(company_id) and public.can_manage_signatures());
drop policy if exists "Managers edit signature visuals" on public.email_signature_templates;
create policy "Managers edit signature visuals" on public.email_signature_templates for update to authenticated
  using (public.same_company(company_id) and public.can_manage_signatures())
  with check (public.same_company(company_id) and public.can_manage_signatures());
drop policy if exists "Managers delete signature visuals" on public.email_signature_templates;
create policy "Managers delete signature visuals" on public.email_signature_templates for delete to authenticated
  using (public.same_company(company_id) and public.can_manage_signatures());
grant select, insert, update, delete on public.email_signature_templates to authenticated;

create or replace function public.email_signature_templates_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.company_id := old.company_id; new.created_by := old.created_by; new.created_at := old.created_at; end if;
  -- only one default visual per company: marking a new one unmarks the previous
  if new.is_default then
    update public.email_signature_templates set is_default = false where company_id = new.company_id and is_default and id <> new.id;
  end if;
  return new;
end $$;
drop trigger if exists email_signature_templates_before on public.email_signature_templates;
create trigger email_signature_templates_before before insert or update on public.email_signature_templates
  for each row execute function public.email_signature_templates_before();

create table if not exists public.email_signature_prefs (
  profile_id uuid primary key default public.get_current_profile_id() references public.profiles(id) on delete cascade,
  template_id uuid references public.email_signature_templates(id) on delete set null,
  fields jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object' and length(fields::text) <= 5000),
  updated_at timestamptz not null default now()
);
alter table public.email_signature_prefs enable row level security;
drop policy if exists "Own signature" on public.email_signature_prefs;
create policy "Own signature" on public.email_signature_prefs for all to authenticated
  using (profile_id = public.get_current_profile_id())
  with check (profile_id = public.get_current_profile_id()
    and (template_id is null or exists (select 1 from public.email_signature_templates t where t.id = template_id and public.same_company(t.company_id))));
grant select, insert, update, delete on public.email_signature_prefs to authenticated;

-- logos of the visuals: company-logos/signatures/<company id>/<file>
drop policy if exists "Signature managers upload logos" on storage.objects;
create policy "Signature managers upload logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'company-logos' and (storage.foldername(name))[1] = 'signatures'
    and (storage.foldername(name))[2] = public.current_company_id()::text and public.can_manage_signatures());
drop policy if exists "Signature managers delete logos" on storage.objects;
create policy "Signature managers delete logos" on storage.objects for delete to authenticated
  using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = 'signatures'
    and (storage.foldername(name))[2] = public.current_company_id()::text and public.can_manage_signatures());

-- company switch: show the signature in everyone's Meu Perfil (default) or keep it hidden
create table if not exists public.email_signature_settings (
  company_id uuid primary key default public.current_company_id() references public.companies(id) on delete cascade,
  show_to_users boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.email_signature_settings enable row level security;
drop policy if exists "Company reads signature settings" on public.email_signature_settings;
create policy "Company reads signature settings" on public.email_signature_settings for select to authenticated
  using (public.same_company(company_id));
drop policy if exists "Managers write signature settings" on public.email_signature_settings;
create policy "Managers write signature settings" on public.email_signature_settings for all to authenticated
  using (public.same_company(company_id) and public.can_manage_signatures())
  with check (public.same_company(company_id) and public.can_manage_signatures());
grant select, insert, update on public.email_signature_settings to authenticated;
