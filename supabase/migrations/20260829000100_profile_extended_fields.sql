alter table public.profiles
  add column if not exists cover_url text,
  add column if not exists description text,
  add column if not exists address text;

comment on column public.profiles.cover_url is 'URL da imagem de capa personalizada do perfil';
comment on column public.profiles.description is 'Descrição pessoal exibida no perfil';
comment on column public.profiles.address is 'Endereço informado pelo próprio usuário';
