#!/usr/bin/env bash
# Copies the Mipas Supabase project into a new, empty project (e.g. in another region).
#
# The database steps are the `supabase db dump` pipeline (apps/cli-go/pkg/migration in
# github.com/supabase/cli) run with the local PostgreSQL client instead of Docker, plus
# the Storage RLS policies, which that dump leaves out. Files go through copy-photos.mjs.
# Flags are spelled out in full: on Windows, pg_dumpall rejects the CLI's abbreviations.
#
# In Git Bash, from the repo root:
#   bash scripts/supabase-move/move.sh dump             # old project -> $MOVE_DIR
#   bash scripts/supabase-move/move.sh restore          # $MOVE_DIR -> new project
#   bash scripts/supabase-move/move.sh photos           # Storage files, old -> new
#   bash scripts/supabase-move/move.sh photos --verify  # re-downloads them from the new one
#   bash scripts/supabase-move/move.sh check            # new project vs. what was dumped
#
# Passwords and keys are asked for (or read from the environment) and never saved.
# $MOVE_DIR ends up holding user emails and password hashes: delete it when done.
set -euo pipefail

MOVE_DIR="${MOVE_DIR:-$HOME/mipas-supabase-move}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

INTERNAL_SCHEMAS='information_schema|pg_*|_analytics|_realtime|_supavisor|auth|etl|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault'
DATA_EXCLUDED_SCHEMAS='information_schema|pg_*|graphql|graphql_public|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault|etl|extensions|pgbouncer|realtime|supabase_migrations|_analytics|_realtime|_supavisor'
RESERVED_ROLES='anon|authenticated|authenticator|cli_login_.*|dashboard_user|pgbouncer|postgres|service_role|supabase_.*|pgsodium_keyholder|pgsodium_keyiduser|pgsodium_keymaker|pgtle_admin'
ALLOWED_CONFIGS='pgaudit.*|pgrst.*|session_replication_role|statement_timeout|track_io_timing'

# With an empty search_path, the policy expressions come out with schema-qualified names.
STORAGE_POLICIES_SQL="
set search_path = '';
select format('drop policy if exists %I on %I.%I;', policyname, schemaname, tablename) || E'\n'
    || format('create policy %I on %I.%I as %s for %s to %s', policyname, schemaname, tablename,
              lower(permissive), lower(cmd),
              (select string_agg(case when r = 'public' then 'public' else quote_ident(r) end, ', ')
                 from unnest(roles::text[]) as r))
    || coalesce(E'\n  using (' || qual || ')', '')
    || coalesce(E'\n  with check (' || with_check || ')', '')
    || ';'
  from pg_policies
 where schemaname = 'storage'
 order by tablename, policyname;"

OBJECTS_SQL="
select coalesce(json_agg(json_build_object(
         'bucket', bucket_id,
         'name', name,
         'size', (metadata->>'size')::bigint,
         'mimetype', metadata->>'mimetype',
         'cacheControl', metadata->>'cacheControl'
       ) order by bucket_id, name), '[]')
  from storage.objects;"

COUNTS_SQL="
select format('%s.%s %s', table_schema, table_name,
         (xpath('/row/c/text()', query_to_xml(
           format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text)
  from information_schema.tables
 where table_type = 'BASE TABLE'
   and (table_schema = 'public'
        or (table_schema, table_name) in (('auth', 'users'), ('auth', 'identities'),
                                          ('storage', 'buckets'), ('storage', 'objects')))
 order by 1;"

EXTENSIONS_SQL="select extname from pg_extension order by 1;"

AUTH_STORAGE_EXTRAS_SQL="
select distinct 'trigger ' || n.nspname || '.' || c.relname || ' ' || t.tgname
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where not t.tgisinternal and n.nspname in ('auth', 'storage')
union
select 'policy ' || schemaname || '.' || tablename || ' ' || policyname
  from pg_policies
 where schemaname in ('auth', 'storage')
 order by 1;"

PRIVILEGES_SQL="
select format('%s %s.%s %s', grantee, table_schema, table_name, privilege_type)
  from information_schema.role_table_grants
 where table_schema = 'public'
union
select format('%s %s.%s.%s %s', grantee, table_schema, table_name, column_name, privilege_type)
  from information_schema.column_privileges
 where table_schema = 'public'
union
select format('%s %s %s', p.oid::regprocedure,
              case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end, a.privilege_type)
  from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
 where p.pronamespace = 'public'::regnamespace
union
select format('default %s %s %s %s', coalesce(n.nspname, '*'), d.defaclobjtype,
              case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end, a.privilege_type)
  from pg_default_acl d
  left join pg_namespace n on n.oid = d.defaclnamespace
 cross join aclexplode(d.defaclacl) a
 where d.defaclrole = 'postgres'::regrole
 order by 1;"

# A new Supabase project grants everything on new tables in public to anon and the other
# API roles (default privileges). The dump assumes tables start with no grants, so with
# those in place the restored tables would be readable in full by anon again, undoing the
# column-level revokes. They are lifted for the restore and put back as they were after it.
LIFT_DEFAULT_PRIVILEGES_SQL="
create temp table mipas_default_acl on commit drop as
select n.nspname, a.privilege_type,
       case d.defaclobjtype when 'r' then 'tables' when 'S' then 'sequences' when 'f' then 'functions'
                            when 'T' then 'types' when 'n' then 'schemas' when 'L' then 'large objects' end as objects,
       case when a.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(a.grantee)) end as grantee
  from pg_default_acl d
  left join pg_namespace n on n.oid = d.defaclnamespace
 cross join aclexplode(d.defaclacl) a
 where d.defaclrole = 'postgres'::regrole and a.grantee <> d.defaclrole;
do \$\$
declare r record;
begin
  for r in select * from pg_temp.mipas_default_acl loop
    execute format('alter default privileges for role postgres %s revoke %s on %s from %s',
                   coalesce('in schema ' || quote_ident(r.nspname), ''), r.privilege_type, r.objects, r.grantee);
  end loop;
end
\$\$;"

RESTORE_DEFAULT_PRIVILEGES_SQL="
do \$\$
declare r record;
begin
  for r in select * from pg_temp.mipas_default_acl loop
    execute format('alter default privileges for role postgres %s grant %s on %s to %s',
                   coalesce('in schema ' || quote_ident(r.nspname), ''), r.privilege_type, r.objects, r.grantee);
  end loop;
end
\$\$;"

fail() { echo "✗ $*" >&2; exit 1; }

ask() {
  local var="$1" prompt="$2" default="${3:-}" answer
  if [ -z "${!var:-}" ]; then
    read -rp "$prompt${default:+ [$default]}: " answer
    printf -v "$var" '%s' "${answer:-$default}"
  fi
  [ -n "${!var}" ] || fail "Faltou: $prompt"
}

ask_secret() {
  local var="$1" prompt="$2" answer
  if [ -z "${!var:-}" ]; then
    read -rsp "$prompt (não aparece enquanto digita): " answer
    echo
    printf -v "$var" '%s' "$answer"
  fi
  [ -n "${!var}" ] || fail "Faltou: $prompt"
}

pg_tool() {
  local tool="$1" dir found=""
  if command -v "$tool" >/dev/null 2>&1; then
    command -v "$tool"
    return
  fi
  while IFS= read -r dir; do
    [ -x "$dir/$tool.exe" ] && found="$dir/$tool.exe"
  done < <(printf '%s\n' "/c/Program Files/PostgreSQL/"*/bin | sort -V)
  [ -n "$found" ] || fail "Não achei o $tool. Instale o PostgreSQL (só as ferramentas de linha de comando bastam)."
  echo "$found"
}

PG_DUMP="$(pg_tool pg_dump)"
PG_DUMPALL="$(pg_tool pg_dumpall)"
PSQL="$(pg_tool psql)"

# Sets DB_URL (without the password, which goes through PGPASSWORD) and DB_REF.
use_db() {
  local side="$1" label url_var="${1}_DB_URL" pass_var="${1}_DB_PASSWORD"
  label=$([ "$side" = OLD ] && echo ANTIGO || echo NOVO)
  ask "$url_var" "Connection string do projeto $label (Connect > Session pooler)"
  DB_URL="${!url_var}"
  [[ "$DB_URL" =~ ^postgres(ql)?:// ]] || fail "Isso não parece uma connection string (postgresql://...)."
  [[ "$DB_URL" != *":6543/"* ]] || fail "Essa é a do Transaction pooler (porta 6543). Use a do Session pooler (porta 5432)."
  unset PGPASSWORD
  if [[ "$DB_URL" == *"[YOUR-PASSWORD]"* ]]; then
    DB_URL="${DB_URL/:\[YOUR-PASSWORD\]/}"
    ask_secret "$pass_var" "Senha do banco do projeto $label"
    export PGPASSWORD="${!pass_var}"
  elif [ -n "${!pass_var:-}" ]; then
    export PGPASSWORD="${!pass_var}"
  fi
  DB_REF=""
  if [[ "$DB_URL" =~ //postgres\.([a-z0-9]+)[:@] ]] || [[ "$DB_URL" =~ @db\.([a-z0-9]+)\.supabase\. ]]; then
    DB_REF="${BASH_REMATCH[1]}"
  fi
  local region=""
  if [[ "$DB_URL" =~ @aws-[0-9]+-([a-z0-9-]+)\.pooler\.supabase\.com ]]; then
    region="${BASH_REMATCH[1]}"
  fi
  export PGCONNECT_TIMEOUT=30
  q "select 1" >/dev/null \
    || fail "Não consegui conectar no projeto $label. Confira a senha e se a connection string é a do Session pooler."
  local client server
  client="$("$PG_DUMP" --version | grep -oE '[0-9]+' | head -1)"
  server="$(q "show server_version_num")"
  server=$((server / 10000))
  [ "$client" -ge "$server" ] || fail "O pg_dump é da versão $client e o banco é $server: instale o PostgreSQL $server ou mais novo."
  echo "Conectado no projeto $label${DB_REF:+ ($DB_REF)}${region:+, região $region}, Postgres $server."
}

q() {
  "$PSQL" --dbname="$DB_URL" --no-psqlrc --quiet --tuples-only --no-align \
    --variable ON_ERROR_STOP=1 --command "$1"
}

dump_roles() {
  "$PG_DUMPALL" --dbname="$DB_URL" \
    --roles-only --role "postgres" --quote-all-identifiers --no-role-passwords --no-comments \
  | sed -E 's/^\\(un)?restrict .*$/-- &/' \
  | sed -E "s/^CREATE ROLE \"($RESERVED_ROLES)\"/-- &/" \
  | sed -E "s/^ALTER ROLE \"($RESERVED_ROLES)\"/-- &/" \
  | sed -E "s/ (NOSUPERUSER|NOREPLICATION)//g" \
  | sed -E "s/^-- (.* SET \"($ALLOWED_CONFIGS)\" .*)/\1/" \
  | sed -E "s/GRANT \".*\" TO \"($RESERVED_ROLES)\"/-- &/" \
  | sed -E "s/^GRANT (.+) ON PARAMETER (.+) TO \"($RESERVED_ROLES)\"/-- &/" \
  | sed -E '/^--/d' \
  | uniq
  echo "RESET ALL;"
}

# Beyond the CLI's rules, a few lines that only restate what a new project already has are
# dropped, since each needs an owner that may differ: "supabase_admin" ownership (the restore
# guide says to comment it out when it fails), the Realtime publication's owner and the
# stock comment on the public schema.
dump_schema() {
  "$PG_DUMP" --dbname="$DB_URL" \
    --schema-only --quote-all-identifiers --role "postgres" \
    --exclude-schema "$INTERNAL_SCHEMAS" \
  | sed -E 's/^\\(un)?restrict .*$/-- &/' \
  | sed -E 's/^CREATE SCHEMA "/CREATE SCHEMA IF NOT EXISTS "/' \
  | sed -E 's/^CREATE TABLE "/CREATE TABLE IF NOT EXISTS "/' \
  | sed -E 's/^CREATE SEQUENCE "/CREATE SEQUENCE IF NOT EXISTS "/' \
  | sed -E 's/^CREATE VIEW "/CREATE OR REPLACE VIEW "/' \
  | sed -E 's/^CREATE FUNCTION "/CREATE OR REPLACE FUNCTION "/' \
  | sed -E 's/^CREATE TRIGGER "/CREATE OR REPLACE TRIGGER "/' \
  | sed -E 's/^CREATE PUBLICATION "supabase_realtime/-- &/' \
  | sed -E 's/^CREATE EVENT TRIGGER /-- &/' \
  | sed -E 's/^         WHEN TAG IN /-- &/' \
  | sed -E 's/^   EXECUTE FUNCTION /-- &/' \
  | sed -E 's/^ALTER EVENT TRIGGER /-- &/' \
  | sed -E 's/^ALTER PUBLICATION "supabase_realtime_/-- &/' \
  | sed -E 's/^ALTER FOREIGN DATA WRAPPER (.+) OWNER TO /-- &/' \
  | sed -E 's/^ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"/-- &/' \
  | sed -E 's/^GRANT ALL ON FOREIGN DATA WRAPPER (.+) TO "postgres" WITH GRANT OPTION/-- &/' \
  | sed -E "s/^GRANT (.+) ON (.+) \"($INTERNAL_SCHEMAS)\"/-- &/" \
  | sed -E "s/^REVOKE (.+) ON (.+) \"($INTERNAL_SCHEMAS)\"/-- &/" \
  | sed -E 's/^(CREATE EXTENSION IF NOT EXISTS "pg_tle").+/\1;/' \
  | sed -E 's/^(CREATE EXTENSION IF NOT EXISTS "pgsodium").+/\1;/' \
  | sed -E 's/^(CREATE EXTENSION IF NOT EXISTS "pgmq").+/\1;/' \
  | sed -E 's/^COMMENT ON EXTENSION (.+)/-- &/' \
  | sed -E 's/^CREATE POLICY "cron_job_/-- &/' \
  | sed -E 's/^ALTER TABLE "cron"/-- &/' \
  | sed -E 's/^SET transaction_timeout = 0;/-- &/' \
  | sed -E 's/^ALTER (.+) OWNER TO "supabase_admin";/-- &/' \
  | sed -E 's/^ALTER PUBLICATION "supabase_realtime" OWNER TO /-- &/' \
  | sed -E "s/^COMMENT ON SCHEMA \"public\" IS 'standard public schema';/-- &/" \
  | sed -E '/^--/d'
}

dump_data() {
  echo "SET session_replication_role = replica;"
  echo
  "$PG_DUMP" --dbname="$DB_URL" \
    --data-only --quote-all-identifiers --role "postgres" \
    --exclude-schema "$DATA_EXCLUDED_SCHEMAS" \
    --exclude-table "auth.schema_migrations" \
    --exclude-table "storage.migrations" \
    --exclude-table "supabase_functions.migrations" \
    --schema "*" \
    --exclude-table '"storage"."buckets_vectors"' \
    --exclude-table '"storage"."vector_indexes"' \
  | sed -E 's/^\\(un)?restrict .*$/-- &/'
  echo "RESET ALL;"
}

cmd_dump() {
  use_db OLD
  mkdir -p "$MOVE_DIR"
  echo "Copiando o banco para $MOVE_DIR ..."
  dump_roles > "$MOVE_DIR/roles.sql"
  dump_schema > "$MOVE_DIR/schema.sql"
  dump_data > "$MOVE_DIR/data.sql"
  q "$STORAGE_POLICIES_SQL" > "$MOVE_DIR/storage_policies.sql"
  q "$OBJECTS_SQL" > "$MOVE_DIR/objects.json"
  q "$COUNTS_SQL" > "$MOVE_DIR/counts_old.txt"
  q "$EXTENSIONS_SQL" > "$MOVE_DIR/extensions_old.txt"
  q "$AUTH_STORAGE_EXTRAS_SQL" > "$MOVE_DIR/auth_storage_old.txt"
  q "$PRIVILEGES_SQL" > "$MOVE_DIR/privileges_old.txt"
  printf '%s\n' "$DB_REF" > "$MOVE_DIR/old_ref.txt"
  echo "✓ Pronto. Linhas por tabela no projeto antigo:"
  sed 's/^/    /' "$MOVE_DIR/counts_old.txt"
  echo "  Arquivos no Storage: $( (grep -o '"bucket"' "$MOVE_DIR/objects.json" || true) | wc -l | tr -d ' ')"
}

cmd_restore() {
  local f
  for f in roles schema data storage_policies; do
    [ -s "$MOVE_DIR/$f.sql" ] || fail "Falta $MOVE_DIR/$f.sql — rode 'dump' antes."
  done
  use_db NEW
  if [ -n "$DB_REF" ] && [ "$DB_REF" = "$(cat "$MOVE_DIR/old_ref.txt" 2>/dev/null)" ]; then
    fail "Essa connection string é do projeto ANTIGO. A restauração é no projeto NOVO."
  fi
  local tables users
  tables="$(q "select count(*) from pg_tables where schemaname = 'public'")"
  users="$(q "select count(*) from auth.users")"
  [ "$tables" = 0 ] && [ "$users" = 0 ] \
    || fail "O projeto NOVO não está vazio ($tables tabelas em public, $users usuários). A restauração é só para um projeto recém-criado."
  echo "Restaurando (tudo numa transação: se algo falhar, nada fica pela metade) ..."
  PGOPTIONS='-c client_min_messages=warning' "$PSQL" --dbname="$DB_URL" --no-psqlrc --quiet \
    --single-transaction --variable ON_ERROR_STOP=1 \
    --command "$LIFT_DEFAULT_PRIVILEGES_SQL" \
    --file "$MOVE_DIR/roles.sql" \
    --file "$MOVE_DIR/schema.sql" \
    --command 'SET session_replication_role = replica' \
    --file "$MOVE_DIR/data.sql" \
    --file "$MOVE_DIR/storage_policies.sql" \
    --command "$RESTORE_DEFAULT_PRIVILEGES_SQL" \
    --command "NOTIFY pgrst, 'reload schema'" \
    > /dev/null \
    || fail "A restauração falhou (erro acima) e foi desfeita: o projeto NOVO continua vazio."
  echo "✓ Banco restaurado. Próximo passo: photos"
}

cmd_photos() {
  local mode="${1:-}"
  [ -z "$mode" ] || [ "$mode" = --dry-run ] || [ "$mode" = --verify ] || fail "Opção desconhecida: $mode"
  [ -s "$MOVE_DIR/objects.json" ] || fail "Falta $MOVE_DIR/objects.json — rode 'dump' antes."
  if [ "$mode" != --verify ]; then
    local current
    current="$(grep -oE 'https://[a-z0-9]+\.supabase\.co' "$SCRIPT_DIR/../../src/theme.ts" | head -1 || true)"
    ask OLD_SUPABASE_URL "URL da API do projeto ANTIGO" "$current"
    ask_secret OLD_SECRET_KEY "Chave secreta do projeto ANTIGO (secret ou service_role)"
  fi
  if [ "$mode" != --dry-run ]; then
    ask NEW_SUPABASE_URL "URL da API do projeto NOVO (https://<ref>.supabase.co)"
    ask_secret NEW_SECRET_KEY "Chave secreta do projeto NOVO (secret ou service_role)"
  fi
  [ "${OLD_SUPABASE_URL:-}" != "${NEW_SUPABASE_URL:-}" ] || fail "As URLs dos dois projetos são iguais."
  OLD_SUPABASE_URL="${OLD_SUPABASE_URL:-}" OLD_SECRET_KEY="${OLD_SECRET_KEY:-}" \
  NEW_SUPABASE_URL="${NEW_SUPABASE_URL:-}" NEW_SECRET_KEY="${NEW_SECRET_KEY:-}" \
    node "$SCRIPT_DIR/copy-photos.mjs" "$MOVE_DIR/objects.json" $mode
}

compare() {
  local title="$1" old="$MOVE_DIR/$2" new="$MOVE_DIR/$3" hint="$4"
  if diff -q "$old" "$new" >/dev/null; then
    echo "✓ $title: iguais"
  else
    echo "✗ $title — só no antigo (-) / só no novo (+):"
    diff -u "$old" "$new" | tail -n +3 | grep -E '^[-+]' | sed 's/^/    /' || true
    [ -z "$hint" ] || echo "  $hint"
  fi
}

cmd_check() {
  [ -s "$MOVE_DIR/counts_old.txt" ] || fail "Falta $MOVE_DIR/counts_old.txt — rode 'dump' antes."
  use_db NEW
  q "$COUNTS_SQL" > "$MOVE_DIR/counts_new.txt"
  q "$EXTENSIONS_SQL" > "$MOVE_DIR/extensions_new.txt"
  q "$AUTH_STORAGE_EXTRAS_SQL" > "$MOVE_DIR/auth_storage_new.txt"
  q "$PRIVILEGES_SQL" > "$MOVE_DIR/privileges_new.txt"
  compare "Linhas por tabela" counts_old.txt counts_new.txt ""
  compare "Permissões (tabelas, colunas, funções)" privileges_old.txt privileges_new.txt \
    "Permissão a mais para anon expõe colunas privadas: não publique o site novo assim."
  compare "Extensões" extensions_old.txt extensions_new.txt \
    "Se faltar no novo alguma que o app usa, ative em Database > Extensions."
  compare "Triggers e policies em auth/storage" auth_storage_old.txt auth_storage_new.txt \
    "Diferenças em triggers internos do Supabase são normais; policies do app precisam bater."
}

case "${1:-}" in
  dump) cmd_dump ;;
  restore) cmd_restore ;;
  photos) cmd_photos "${2:-}" ;;
  check) cmd_check ;;
  *) sed -n '9,14p' "${BASH_SOURCE[0]}" | sed -E 's/^# ?//'; exit 1 ;;
esac
