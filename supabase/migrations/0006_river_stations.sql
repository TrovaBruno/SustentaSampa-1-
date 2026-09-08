-- Inventário de estações fluviométricas da ANA (nome, rio/bacia, coordenadas).
-- Preenchido pela Edge Function ana-sync-stations, via service role
-- (por isso não há policy de insert/update/delete para usuários comuns).

create table if not exists public.river_stations (
  codigo_estacao text primary key,
  nome text not null,
  rio_bacia text,
  municipio text,
  uf text,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);

alter table public.river_stations enable row level security;

create policy "river stations are viewable by authenticated users"
on public.river_stations for select
to authenticated
using (true);

create index if not exists river_stations_lat_idx on public.river_stations (lat);
create index if not exists river_stations_lng_idx on public.river_stations (lng);
create index if not exists river_stations_nome_idx on public.river_stations (nome);
