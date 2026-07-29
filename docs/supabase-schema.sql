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
  category     text,
  rating       numeric(3,1),
  description  text,
  avg_price    numeric(10,2),
  instagram    text,
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

-- Fotos de cada lugar. O arquivo em si mora no Supabase Storage (bucket
-- "place-photos", ver seção de Storage mais abaixo); esta tabela só guarda
-- o caminho e a dona (place_id -> places -> lists.is_public controla quem lê).
create table public.place_photos (
  id            uuid primary key default gen_random_uuid(),
  place_id      uuid not null references public.places(id) on delete cascade,
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path  text not null,
  title         text,
  description   text,
  created_at    timestamptz not null default now()
);

create index idx_places_list_id on public.places(list_id);
create index idx_places_owner_id on public.places(owner_id);
create index idx_lists_owner_id on public.lists(owner_id);
create index idx_lists_public on public.lists(is_public) where is_public = true;
create index idx_place_photos_place_id on public.place_photos(place_id);

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

alter table public.place_photos enable row level security;

create policy "public can read photos of public lists" on public.place_photos
  for select to anon, authenticated using (
    exists (
      select 1 from public.places p join public.lists l on l.id = p.list_id
      where p.id = place_photos.place_id and l.is_public = true
    )
  );

create policy "owner can read own photos" on public.place_photos
  for select to authenticated using (auth.uid() = owner_id);

create policy "owner can insert own photos" on public.place_photos
  for insert to authenticated with check (
    auth.uid() = owner_id
    and exists (select 1 from public.places p where p.id = place_photos.place_id and p.owner_id = auth.uid())
  );

create policy "owner can update own photos" on public.place_photos
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owner can delete own photos" on public.place_photos
  for delete to authenticated using (auth.uid() = owner_id);

-- ---------------------------------------------------------
-- Privacidade por COLUNA. RLS filtra linhas, não colunas: sem isto, quem
-- abre uma lista pública lê todas as colunas dessas linhas — inclusive
-- "note", que na interface é a nota pessoal do dono. Em Postgres não dá pra
-- revogar uma coluna solta enquanto existe SELECT no nível da tabela: revoga
-- a tabela e reconcede só as colunas públicas.
-- ---------------------------------------------------------

revoke select on public.lists from anon;
grant select (id, name, emoji, color, is_public, ranking_enabled, created_at)
  on public.lists to anon;

revoke select on public.places from anon;
grant select (id, list_id, name, address, latitude, longitude,
              rank, category, rating, description, avg_price, instagram, created_at)
  on public.places to anon;

revoke select on public.place_photos from anon;
grant select (id, place_id, storage_path, title, description, created_at)
  on public.place_photos to anon;

-- ---------------------------------------------------------
-- Storage — bucket de fotos ("place-photos")
-- Bucket PRIVADO: com bucket público qualquer URL de foto abre sem login,
-- inclusive de lista privada, e a policy de leitura permitia listar o bucket
-- inteiro (ou seja, descobrir os caminhos de todas as fotos). Agora a leitura
-- passa pelas mesmas regras das listas, e o app serve as imagens por URL
-- assinada temporária. Escrita (upload/update/delete) só o dono, via policy
-- que confere o primeiro segmento do caminho = auth.uid() — por isso o app
-- sempre salva fotos em "{owner_id}/{place_id}/arquivo.ext".
-- ---------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', false)
on conflict (id) do update set public = false;

create policy "anyone can read photos of public lists" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'place-photos'
    and exists (
      select 1 from public.place_photos ph
      join public.places p on p.id = ph.place_id
      join public.lists l on l.id = p.list_id
      where ph.storage_path = storage.objects.name and l.is_public = true
    )
  );

create policy "owner can read own place photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner can upload own place photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner can update own place photos" on storage.objects
  for update to authenticated using (
    bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner can delete own place photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Por que é seguro mesmo com a anon key pública no código do site:
-- não existe nenhuma policy de insert/update/delete para "anon" — só select,
-- e só de linhas is_public = true. Quem protege os dados são estas policies,
-- nunca o sigilo da anon key (a service_role key, essa sim secreta, nunca
-- deve entrar no front-end).

-- ---------------------------------------------------------
-- Migração incremental (2026-07-29) — rank/distância, categoria, nota,
-- descrição, média de valor e fotos.
-- Rodar isto uma vez no projeto Supabase que já está no ar (create table
-- acima já reflete o estado final, isto aqui é só pra bancos existentes).
-- Idempotente: pode rodar de novo sem erro.
-- ---------------------------------------------------------

alter table public.lists add column if not exists ranking_enabled boolean not null default false;
alter table public.places add column if not exists rank integer;
alter table public.places add column if not exists category text;
alter table public.places add column if not exists rating numeric(3,1);
alter table public.places add column if not exists description text;
alter table public.places add column if not exists avg_price numeric(10,2);
alter table public.places add column if not exists instagram text;

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

create table if not exists public.place_photos (
  id            uuid primary key default gen_random_uuid(),
  place_id      uuid not null references public.places(id) on delete cascade,
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path  text not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_place_photos_place_id on public.place_photos(place_id);

alter table public.place_photos add column if not exists title text;
alter table public.place_photos add column if not exists description text;

alter table public.place_photos enable row level security;

drop policy if exists "public can read photos of public lists" on public.place_photos;
create policy "public can read photos of public lists" on public.place_photos
  for select to anon, authenticated using (
    exists (
      select 1 from public.places p join public.lists l on l.id = p.list_id
      where p.id = place_photos.place_id and l.is_public = true
    )
  );

drop policy if exists "owner can read own photos" on public.place_photos;
create policy "owner can read own photos" on public.place_photos
  for select to authenticated using (auth.uid() = owner_id);

drop policy if exists "owner can insert own photos" on public.place_photos;
create policy "owner can insert own photos" on public.place_photos
  for insert to authenticated with check (
    auth.uid() = owner_id
    and exists (select 1 from public.places p where p.id = place_photos.place_id and p.owner_id = auth.uid())
  );

drop policy if exists "owner can update own photos" on public.place_photos;
create policy "owner can update own photos" on public.place_photos
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owner can delete own photos" on public.place_photos;
create policy "owner can delete own photos" on public.place_photos
  for delete to authenticated using (auth.uid() = owner_id);

insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', true)
on conflict (id) do nothing;

drop policy if exists "public can view place photos" on storage.objects;
create policy "public can view place photos" on storage.objects
  for select to anon, authenticated using (bucket_id = 'place-photos');

drop policy if exists "owner can upload own place photos" on storage.objects;
create policy "owner can upload own place photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner can update own place photos" on storage.objects;
create policy "owner can update own place photos" on storage.objects
  for update to authenticated using (
    bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner can delete own place photos" on storage.objects;
create policy "owner can delete own place photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------
-- Migração incremental (2026-07-29b) — correções de privacidade.
-- 1) "note" (nota pessoal) e "owner_id" deixam de ser legíveis por anon.
-- 2) Bucket de fotos deixa de ser público; leitura passa a seguir as mesmas
--    regras das listas, e o app serve imagens por URL assinada.
-- ATENÇÃO: rodar isto junto com o deploy do site novo — o site antigo usa
-- select('*') e getPublicUrl(), que param de funcionar depois desta migração.
-- Idempotente: pode rodar de novo sem erro.
-- ---------------------------------------------------------

revoke select on public.lists from anon;
grant select (id, name, emoji, color, is_public, ranking_enabled, created_at)
  on public.lists to anon;

revoke select on public.places from anon;
grant select (id, list_id, name, address, latitude, longitude,
              rank, category, rating, description, avg_price, instagram, created_at)
  on public.places to anon;

revoke select on public.place_photos from anon;
grant select (id, place_id, storage_path, title, description, created_at)
  on public.place_photos to anon;

update storage.buckets set public = false where id = 'place-photos';

drop policy if exists "public can view place photos" on storage.objects;

drop policy if exists "anyone can read photos of public lists" on storage.objects;
create policy "anyone can read photos of public lists" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'place-photos'
    and exists (
      select 1 from public.place_photos ph
      join public.places p on p.id = ph.place_id
      join public.lists l on l.id = p.list_id
      where ph.storage_path = storage.objects.name and l.is_public = true
    )
  );

drop policy if exists "owner can read own place photos" on storage.objects;
create policy "owner can read own place photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- O PostgREST guarda as permissões em cache; sem isto as mudanças de grant
-- acima podem demorar a valer na API REST.
notify pgrst, 'reload schema';
