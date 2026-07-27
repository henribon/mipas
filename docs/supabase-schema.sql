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
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  emoji       text not null default '📍',
  color       text not null default '#FF5C38',
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
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
  created_at   timestamptz not null default now()
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

-- Por que é seguro mesmo com a anon key pública no código do site:
-- não existe nenhuma policy de insert/update/delete para "anon" — só select,
-- e só de linhas is_public = true. Quem protege os dados são estas policies,
-- nunca o sigilo da anon key (a service_role key, essa sim secreta, nunca
-- deve entrar no front-end).
