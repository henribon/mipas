// Copies Storage files between Supabase projects, keeping path, content type and cache
// header. Run it through `move.sh photos`, which asks for the keys and passes the file list
// saved by `move.sh dump`. --dry-run only downloads from the old project; --verify
// downloads everything from the new one and checks the sizes.
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const PARALLEL = 4;

const [listFile, mode = ''] = process.argv.slice(2);

function project(prefix) {
  const url = process.env[`${prefix}_SUPABASE_URL`];
  const key = process.env[`${prefix}_SECRET_KEY`];
  if (!url || !key) throw new Error(`Faltou ${prefix}_SUPABASE_URL ou ${prefix}_SECRET_KEY`);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const objects = JSON.parse(await readFile(listFile, 'utf8'));
const source = mode === '--verify' ? null : project('OLD');
const target = mode === '--dry-run' ? null : project('NEW');

const maxAgeSeconds = (cacheControl) => /max-age=(\d+)/.exec(cacheControl || '')?.[1] ?? '3600';

async function download(client, object) {
  const { data, error } = await client.storage.from(object.bucket).download(object.name);
  if (error) throw error;
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (object.size != null && bytes.byteLength !== Number(object.size)) {
    throw new Error(`veio com ${bytes.byteLength} bytes, esperado ${object.size}`);
  }
  return bytes;
}

async function transfer(object) {
  if (mode === '--verify') return download(target, object);
  const bytes = await download(source, object);
  if (mode === '--dry-run') return;
  // Raw bytes, not a Blob: only then does supabase-js send contentType and cacheControl as headers.
  const { error } = await target.storage.from(object.bucket).upload(object.name, bytes, {
    upsert: true,
    contentType: object.mimetype || 'application/octet-stream',
    cacheControl: maxAgeSeconds(object.cacheControl),
  });
  if (error) throw error;
}

const queue = [...objects];
const failures = [];
let done = 0;

await Promise.all(Array.from({ length: PARALLEL }, async () => {
  for (let object = queue.shift(); object; object = queue.shift()) {
    try {
      await transfer(object);
    } catch (e) {
      failures.push(`${object.bucket}/${object.name}: ${e?.message || e}`);
    }
    done += 1;
    process.stdout.write(`\r${done}/${objects.length} arquivos`);
  }
}));

const outcome = { '--dry-run': 'baixados do projeto antigo (teste, nada foi enviado)', '--verify': 'conferidos no projeto novo' }[mode]
  || 'copiados para o projeto novo';
console.log(`\n${objects.length - failures.length} de ${objects.length} ${outcome}.`);
if (failures.length) {
  console.log('Falharam (rode de novo: quem já foi copiado é sobrescrito sem problema):');
  failures.forEach(failure => console.log(`  ${failure}`));
  process.exitCode = 1;
}
