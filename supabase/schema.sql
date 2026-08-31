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
  -- Legado: hoje quem diz em quais listas o lugar está é place_lists (ver
  -- migração 2026-07-30). Fica como rede de segurança, nulo e sem uso — por
  -- isso "set null": apagar a lista não pode levar o lugar junto.
  list_id      uuid references public.lists(id) on delete set null,
  name         text not null,
  address      text not null,
  latitude     double precision not null,
  longitude    double precision not null,
  rank         integer,
  category     text,
  rating       numeric(3,1),
  description  text,
  avg_price    numeric(10,2),
  instagram    text,
  -- Foto que o pin do mapa mostra. A referência a place_photos entra logo
  -- depois que a tabela existe (ver alter table abaixo); sem escolha, o app
  -- cai na primeira foto da galeria.
  cover_photo_id uuid,
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
  position      integer,
  created_at    timestamptz not null default now()
);

-- Apagar a foto escolhida não pode levar o lugar junto: o pin só volta a ser
-- o pin de emoji (ou a próxima foto da galeria).
alter table public.places add constraint places_cover_photo_id_fkey
  foreign key (cover_photo_id) references public.place_photos(id) on delete set null;

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
-- "owner_id", que a interface não usa. Em Postgres não dá pra revogar uma
-- coluna solta enquanto existe SELECT no nível da tabela: revoga a tabela e
-- reconcede só as colunas públicas.
-- ---------------------------------------------------------

revoke select on public.lists from anon;
grant select (id, name, emoji, color, is_public, ranking_enabled, created_at)
  on public.lists to anon;

revoke select on public.places from anon;
grant select (id, list_id, name, address, latitude, longitude,
              rank, category, rating, description, avg_price, instagram,
              cover_photo_id, created_at)
  on public.places to anon;

revoke select on public.place_photos from anon;
grant select (id, place_id, storage_path, title, description, position, created_at)
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
grant select (id, place_id, storage_path, title, description, position, created_at)
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

-- ---------------------------------------------------------
-- Migração incremental (2026-07-29c) — uma descrição só.
-- A interface tinha dois textos por lugar: "description" (pública) e "note"
-- (privada). Passa a existir só a descrição; onde a descrição está vazia, o
-- conteúdo da nota é movido pra lá, pra não perder o que já foi escrito.
-- Idempotente: rodar de novo não duplica nada.
-- ---------------------------------------------------------

update public.places
   set description = note
 where note is not null
   and btrim(note) <> ''
   and (description is null or btrim(description) = '');

-- Onde os DOIS tinham texto diferente, a nota é preservada no fim da
-- descrição em vez de ser descartada.
update public.places
   set description = description || E'\n\n' || note
 where note is not null
   and btrim(note) <> ''
   and description is not null
   and btrim(description) <> ''
   and position(note in description) = 0;

-- ---------------------------------------------------------
-- Migração incremental (2026-07-29d) — ordem das fotos.
-- O dono passa a poder arrastar as fotos pra definir a ordem; sem uma coluna
-- pra guardar isso, a ordem se perderia no próximo carregamento.
-- Idempotente.
-- ---------------------------------------------------------

alter table public.place_photos add column if not exists position integer;

-- Sem posição definida, as já existentes seguem a ordem de envio.
update public.place_photos ph
   set position = sub.n
  from (
    select id, (row_number() over (partition by place_id order by created_at) - 1) as n
      from public.place_photos
  ) sub
 where sub.id = ph.id
   and ph.position is null;

-- A leitura pública é por coluna (ver acima): sem reconceder, a posição
-- ficaria invisível pra quem abre a lista pelo link e a ordem não valeria.
grant select (position) on public.place_photos to anon;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Migração incremental (2026-07-30) — um lugar em várias listas.
-- places.list_id guardava UMA lista. Passa a existir a tabela de ligação
-- place_lists, e "público" deixa de ser "a lista do lugar é pública" e vira
-- "ALGUMA lista do lugar é pública" — em places e também nas fotos.
-- places.list_id fica no banco, nulo e sem uso, como rede de segurança.
-- Idempotente: pode rodar de novo sem erro.
-- ---------------------------------------------------------

create table if not exists public.place_lists (
  place_id    uuid not null references public.places(id) on delete cascade,
  list_id     uuid not null references public.lists(id) on delete cascade,
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (place_id, list_id)
);

create index if not exists idx_place_lists_list_id on public.place_lists(list_id);
create index if not exists idx_place_lists_place_id on public.place_lists(place_id);

insert into public.place_lists (place_id, list_id, owner_id)
select p.id, p.list_id, p.owner_id from public.places p
where p.list_id is not null
on conflict (place_id, list_id) do nothing;

alter table public.places alter column list_id drop not null;

alter table public.place_lists enable row level security;

drop policy if exists "public can read links of public lists" on public.place_lists;
create policy "public can read links of public lists" on public.place_lists
  for select to anon, authenticated using (
    exists (select 1 from public.lists l where l.id = place_lists.list_id and l.is_public = true)
  );

drop policy if exists "owner can read own links" on public.place_lists;
create policy "owner can read own links" on public.place_lists
  for select to authenticated using (auth.uid() = owner_id);

drop policy if exists "owner can insert own links" on public.place_lists;
create policy "owner can insert own links" on public.place_lists
  for insert to authenticated with check (
    auth.uid() = owner_id
    and exists (select 1 from public.lists l where l.id = place_lists.list_id and l.owner_id = auth.uid())
    and exists (select 1 from public.places p where p.id = place_lists.place_id and p.owner_id = auth.uid())
  );

drop policy if exists "owner can delete own links" on public.place_lists;
create policy "owner can delete own links" on public.place_lists
  for delete to authenticated using (auth.uid() = owner_id);

drop policy if exists "public can read places of public lists" on public.places;
create policy "public can read places of public lists" on public.places
  for select to anon, authenticated using (
    exists (
      select 1 from public.place_lists pl join public.lists l on l.id = pl.list_id
      where pl.place_id = places.id and l.is_public = true
    )
  );

drop policy if exists "owner can insert own places" on public.places;
create policy "owner can insert own places" on public.places
  for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists "owner can update own places" on public.places;
create policy "owner can update own places" on public.places
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "public can read photos of public lists" on public.place_photos;
create policy "public can read photos of public lists" on public.place_photos
  for select to anon, authenticated using (
    exists (
      select 1 from public.places p
      join public.place_lists pl on pl.place_id = p.id
      join public.lists l on l.id = pl.list_id
      where p.id = place_photos.place_id and l.is_public = true
    )
  );

drop policy if exists "anyone can read photos of public lists" on storage.objects;
create policy "anyone can read photos of public lists" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'place-photos'
    and exists (
      select 1 from public.place_photos ph
      join public.places p on p.id = ph.place_id
      join public.place_lists pl on pl.place_id = p.id
      join public.lists l on l.id = pl.list_id
      where ph.storage_path = storage.objects.name and l.is_public = true
    )
  );

revoke select on public.place_lists from anon;
grant select (place_id, list_id) on public.place_lists to anon;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Migração incremental (2026-07-30b) — "Quero ir".
-- Lista de desejos: lugares que o dono ainda não visitou. Não entram no mapa
-- nem em lista nenhuma, e são estritamente privados — como user_home, não
-- existe policy pra anon aqui. Ao marcar "Fui", o registro vira um place
-- normal e a linha some daqui.
-- Idempotente: pode rodar de novo sem erro.
-- ---------------------------------------------------------

create table if not exists public.wish_places (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  address     text not null,
  latitude    double precision,
  longitude   double precision,
  instagram   text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_wish_places_owner_id on public.wish_places(owner_id);

alter table public.wish_places enable row level security;

drop policy if exists "owner can read own wishes" on public.wish_places;
create policy "owner can read own wishes" on public.wish_places
  for select to authenticated using (auth.uid() = owner_id);

drop policy if exists "owner can insert own wishes" on public.wish_places;
create policy "owner can insert own wishes" on public.wish_places
  for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists "owner can update own wishes" on public.wish_places;
create policy "owner can update own wishes" on public.wish_places
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owner can delete own wishes" on public.wish_places;
create policy "owner can delete own wishes" on public.wish_places
  for delete to authenticated using (auth.uid() = owner_id);

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Migração incremental (2026-08-04) — apagar uma lista não pode apagar
-- lugares que estão em outras listas.
-- places.list_id virou legado na migração de 2026-07-30 (quem manda agora é
-- place_lists), mas a chave estrangeira dele continuou "on delete cascade":
-- nos lugares antigos, que ainda têm list_id preenchido, apagar aquela lista
-- levava o lugar junto mesmo que ele estivesse em outras listas — e nem a
-- limpeza de órfãos do app impedia isso, porque o Postgres apaga antes.
-- Passa a ser "set null": o vínculo antigo se desfaz e o lugar continua vivo
-- enquanto sobrar alguma linha em place_lists (o app apaga o que ficar órfão).
-- Idempotente: derruba qualquer FK que exista sobre list_id antes de recriar.
-- ---------------------------------------------------------

do $$
declare
  fk record;
begin
  for fk in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public'
       and rel.relname = 'places'
       and con.contype = 'f'
       and pg_get_constraintdef(con.oid) like 'FOREIGN KEY (list_id)%'
  loop
    execute format('alter table public.places drop constraint %I', fk.conname);
  end loop;
end $$;

alter table public.places
  add constraint places_list_id_fkey
  foreign key (list_id) references public.lists(id) on delete set null;

-- A migração de 2026-07-30 já tinha tirado o "not null" daqui; repetido porque
-- é barato e garante que a coluna aceite o null que o "set null" vai gravar.
alter table public.places alter column list_id drop not null;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Migração incremental (2026-08-04b) — recursão de RLS entre place_lists e
-- places (erro 42P17, "infinite recursion detected in policy").
-- A migração de 2026-07-30 deixou duas policies se olhando: a de insert em
-- place_lists consulta places, e a de leitura pública de places consulta
-- place_lists. Toda tentativa de vincular um lugar a uma lista voltava em
-- place_lists e o Postgres abortava — ou seja, guardar lugar novo estava
-- quebrado desde então (ler seguia funcionando, porque esse caminho é
-- places -> place_lists -> lists e não repete tabela).
-- A conferência de dono sai da policy e vai pra uma função security definer,
-- que roda como dona das tabelas e por isso não dispara RLS outra vez. A
-- regra continua a mesma: só o dono do lugar E da lista cria o vínculo.
-- Idempotente: pode rodar de novo sem erro.
-- ---------------------------------------------------------

-- search_path vazio + nomes qualificados: numa função security definer, deixar
-- o search_path do chamador valer é porta pra sequestro de nome.
create or replace function public.owns_place(p_place_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.places p
     where p.id = p_place_id and p.owner_id = auth.uid()
  );
$$;

create or replace function public.owns_list(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lists l
     where l.id = p_list_id and l.owner_id = auth.uid()
  );
$$;

-- Só quem está logado precisa delas; anon não usa nenhuma policy que chame isto.
revoke all on function public.owns_place(uuid) from public;
revoke all on function public.owns_list(uuid) from public;
grant execute on function public.owns_place(uuid) to authenticated;
grant execute on function public.owns_list(uuid) to authenticated;

drop policy if exists "owner can insert own links" on public.place_lists;
create policy "owner can insert own links" on public.place_lists
  for insert to authenticated with check (
    auth.uid() = owner_id
    and public.owns_list(list_id)
    and public.owns_place(place_id)
  );

-- Mesmo tratamento aqui: hoje não fecha ciclo, mas é a mesma consulta a places
-- de dentro de uma policy, e passa a custar uma expansão a menos.
drop policy if exists "owner can insert own photos" on public.place_photos;
create policy "owner can insert own photos" on public.place_photos
  for insert to authenticated with check (
    auth.uid() = owner_id and public.owns_place(place_id)
  );

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Migração 2026-08-12 — foto de capa do pin
-- O marcador no mapa deixa de ser só emoji e passa a mostrar uma foto do
-- lugar. Sem escolha explícita o app usa a primeira foto da galeria; esta
-- coluna guarda a escolha a dedo. Apagar a foto escolhida volta o pin pro
-- estado anterior em vez de derrubar o lugar (on delete set null).
--
-- Atenção: com esta chave estrangeira passam a existir dois caminhos entre
-- places e place_photos, e o PostgREST recusa `place_photos(...)` no select
-- sem saber qual usar (PGRST201). Toda query que traz as fotos de um lugar
-- precisa nomear o caminho: place_photos!place_photos_place_id_fkey(...).
-- ---------------------------------------------------------

alter table public.places add column if not exists cover_photo_id uuid;

do $$
begin
  alter table public.places add constraint places_cover_photo_id_fkey
    foreign key (cover_photo_id) references public.place_photos(id) on delete set null;
exception
  when duplicate_object then null;
end
$$;

-- Quem abre uma lista pública precisa ler a coluna, senão o pin volta a ser
-- emoji pra visitante e foto só pro dono.
grant select (cover_photo_id) on public.places to anon;

notify pgrst, 'reload schema';


-- ---------------------------------------------------------
-- Ocultar uma lista do mapa
--
-- Duas escolhas independentes e guardadas no banco: o dono pode tirar a lista
-- do proprio mapa (hidden_for_owner) e pode tira-la do mapa de quem chega ao
-- site sem link (hidden_for_visitor).
--
-- Nao e sigilo: a lista publica continua legivel por link direto, e quem tem o
-- link continua vendo os pins. E so sumir com eles do mapa geral, pra tirar
-- ruido de quem visita. Pra esconder de verdade, a lista tem que deixar de ser
-- publica (is_public = false), que ai a policy de leitura ja barra.
-- ---------------------------------------------------------

alter table public.lists add column if not exists hidden_for_owner boolean not null default false;
alter table public.lists add column if not exists hidden_for_visitor boolean not null default false;

-- O anon le a lista por coluna (nao ha grant amplo nesta tabela); sem isto o
-- visitante nao teria como saber que a lista deve sair do mapa dele.
grant select (hidden_for_visitor) on public.lists to anon;

notify pgrst, 'reload schema';
