-- Mipas — schema inicial para Supabase (Postgres gerenciado).
-- Rodar uma vez, na íntegra, no SQL Editor do dashboard do Supabase
-- (https://app.supabase.com/project/_/sql/new).
--
-- Simplificado em relação à modelagem Java original (V1__create_domain_tables.sql):
-- sem tabela app_user (o dono é o usuário do Supabase Auth, via auth.uid()),
-- 1 lista por lugar (sem tabela de junção), sem place_comment/event (features futuras).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------

create table public.lists (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name             text not null,
  emoji            text not null default '📍',
  color            text not null default '#FF5C38',
  is_public        boolean not null default false,
  ranking_enabled  boolean not null default false,
  created_at       timestamptz not null default now()
);

create table public.places (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_id      uuid not null references public.lists(id) on delete cascade,
  name         text not null,
  address      text not null,
  latitude     double precision not null,
  longitude    double precision not null,
  note         text,
  rank         integer,
  created_at   timestamptz not null default now()
);

-- Ponto de referência privado ("CASA") usado só pra calcular distância — nunca
-- exposto em nenhuma policy pra anon/outros usuários, só o próprio dono lê/escreve.
create table public.user_home (
  owner_id    uuid primary key references auth.users(id) on delete cascade,
  latitude    double precision not null,
  longitude   double precision not null,
  updated_at  timestamptz not null default now()
);

create index idx_places_list_id on public.places(list_id);
create index idx_places_owner_id on public.places(owner_id);
create index idx_lists_owner_id on public.lists(owner_id);
create index idx_lists_public on public.lists(is_public) where is_public = true;

-- ---------------------------------------------------------
-- Row Level Security — obrigatório. Sem isso a API REST automática
-- do Supabase fica aberta para qualquer um com a anon key (que é pública).
-- ---------------------------------------------------------

alter table public.lists enable row level security;

create policy "public can read public lists" on public.lists
  for select to anon, authenticated using (is_public = true);

create policy "owner can read own lists" on public.lists
  for select to authenticated using (auth.uid() = owner_id);

create policy "owner can insert own lists" on public.lists
  for insert to authenticated with check (auth.uid() = owner_id);

create policy "owner can update own lists" on public.lists
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owner can delete own lists" on public.lists
  for delete to authenticated using (auth.uid() = owner_id);

alter table public.places enable row level security;

create policy "public can read places of public lists" on public.places
  for select to anon, authenticated using (
    exists (select 1 from public.lists l where l.id = places.list_id and l.is_public = true)
  );

create policy "owner can read own places" on public.places
  for select to authenticated using (auth.uid() = owner_id);

create policy "owner can insert own places" on public.places
  for insert to authenticated with check (
    auth.uid() = owner_id
    and exists (select 1 from public.lists l where l.id = places.list_id and l.owner_id = auth.uid())
  );

create policy "owner can update own places" on public.places
  for update to authenticated using (auth.uid() = owner_id) with check (
    auth.uid() = owner_id
    and exists (select 1 from public.lists l where l.id = places.list_id and l.owner_id = auth.uid())
  );

create policy "owner can delete own places" on public.places
  for delete to authenticated using (auth.uid() = owner_id);

alter table public.user_home enable row level security;

-- De propósito: nenhuma policy para "anon" aqui. user_home nunca é lido por
-- quem não é o dono, nem em listas públicas — é sempre local ao dono logado.
create policy "owner can read own home" on public.user_home
  for select to authenticated using (auth.uid() = owner_id);

create policy "owner can upsert own home" on public.user_home
  for insert to authenticated with check (auth.uid() = owner_id);

create policy "owner can update own home" on public.user_home
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owner can delete own home" on public.user_home
  for delete to authenticated using (auth.uid() = owner_id);

-- Por que é seguro mesmo com a anon key pública no código do site:
-- não existe nenhuma policy de insert/update/delete para "anon" — só select,
-- e só de linhas is_public = true. Quem protege os dados são estas policies,
-- nunca o sigilo da anon key (a service_role key, essa sim secreta, nunca
-- deve entrar no front-end).

-- ---------------------------------------------------------
-- Migração incremental — feature de rank/distância (2026-07-29)
-- Rodar isto uma vez no projeto Supabase que já está no ar (create table
-- acima já reflete o estado final, isto aqui é só pra bancos existentes).
-- Idempotente: pode rodar de novo sem erro.
-- ---------------------------------------------------------

alter table public.lists add column if not exists ranking_enabled boolean not null default false;
alter table public.places add column if not exists rank integer;

create table if not exists public.user_home (
  owner_id    uuid primary key references auth.users(id) on delete cascade,
  latitude    double precision not null,
  longitude   double precision not null,
  updated_at  timestamptz not null default now()
);

alter table public.user_home enable row level security;

drop policy if exists "owner can read own home" on public.user_home;
create policy "owner can read own home" on public.user_home
  for select to authenticated using (auth.uid() = owner_id);

drop policy if exists "owner can upsert own home" on public.user_home;
create policy "owner can upsert own home" on public.user_home
  for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists "owner can update own home" on public.user_home;
create policy "owner can update own home" on public.user_home
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owner can delete own home" on public.user_home;
create policy "owner can delete own home" on public.user_home
  for delete to authenticated using (auth.uid() = owner_id);
