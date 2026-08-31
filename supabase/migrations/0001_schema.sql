-- Schema do SustentaSampa: perfis, reportes de alagamento e chat da comunidade.
-- Este arquivo é referência do schema já provisionado no seu projeto Supabase.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Usuário',
  points integer not null default 0,
  reports_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- cria automaticamente um profile quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.flood_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  cep text,
  trafficability text not null check (trafficability in ('transitavel', 'veiculos_altos', 'intransitavel')),
  water_level text not null check (water_level in ('canela', 'joelho', 'acima_capo')),
  weight numeric not null default 0.5,
  created_at timestamptz not null default now()
);

alter table public.flood_reports enable row level security;

create policy "flood reports are viewable by authenticated users"
  on public.flood_reports for select
  to authenticated
  using (true);

create policy "users can insert their own flood reports"
  on public.flood_reports for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists flood_reports_created_at_idx on public.flood_reports (created_at desc);
create index if not exists flood_reports_cep_idx on public.flood_reports (cep);

-- soma pontos e contagem de reportes ao usuário quando ele reporta
create or replace function public.handle_new_flood_report()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
    set points = points + 10,
        reports_count = reports_count + 1
    where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists on_flood_report_created on public.flood_reports;
create trigger on_flood_report_created
  after insert on public.flood_reports
  for each row execute function public.handle_new_flood_report();

-- reportes somem do mapa depois de 24h (chamar periodicamente via cron/Edge Function)
create or replace function public.purge_old_flood_reports()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.flood_reports where created_at < now() - interval '24 hours';
$$;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Usuário',
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "chat messages are viewable by authenticated users"
  on public.chat_messages for select
  to authenticated
  using (true);

create policy "users can insert their own chat messages"
  on public.chat_messages for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists chat_messages_created_at_idx on public.chat_messages (created_at asc);

alter publication supabase_realtime add table public.chat_messages;
