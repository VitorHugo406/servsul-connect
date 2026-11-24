-- Linhas de ônibus / trem / metrô / VLT para o "+ › Ônibus/trem" do chat: cópia local dos dados públicos do
-- OpenStreetMap (route relations), carregada por estado pela função transit-sync (no máximo 1x por semana por estado).
-- A busca no app fica instantânea (a consulta direta ao OpenStreetMap levava de 16 s a mais de 1 min).
create table if not exists public.transit_lines (
  id bigserial primary key,
  uf text not null,
  kind text not null check (kind in ('bus', 'train', 'metro', 'tram')),
  ref text not null default '',
  ref_norm text not null default '',
  name text not null default '',
  network text not null default '',
  color text,
  dirs jsonb not null default '[]'::jsonb,       -- [{from, to}] (ida, volta…)
  stations jsonb not null default '[]'::jsonb,   -- trilhos: estações em ordem (sentido da 1ª direção)
  updated_at timestamptz not null default now()
);
create index if not exists transit_lines_lookup on public.transit_lines (uf, kind, ref_norm);

create table if not exists public.transit_sync (
  uf text primary key,
  synced_at timestamptz,
  lines integer not null default 0,
  status text not null default 'ok'
);

alter table public.transit_lines enable row level security;
alter table public.transit_sync enable row level security;
drop policy if exists "Signed-in read transit lines" on public.transit_lines;
create policy "Signed-in read transit lines" on public.transit_lines for select to authenticated using (true);
drop policy if exists "Signed-in read transit sync" on public.transit_sync;
create policy "Signed-in read transit sync" on public.transit_sync for select to authenticated using (true);
-- escrita só pela função (service role)
