// Runs only against an explicitly configured EMPTY, disposable database.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const connection = process.env.DATABASE_TEST_URL;
if (!connection) throw new Error('Defina DATABASE_TEST_URL para um PostgreSQL vazio e descartável.');
const psql = process.env.PSQL_BIN || 'psql';
function run(args, capture = false) {
  const result = spawnSync(psql, ['-X', '--dbname', connection, '-v', 'ON_ERROR_STOP=1', ...args], {
    env: process.env,
    encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) { if (capture) process.stderr.write(result.stderr); process.exit(result.status || 1); }
  return result.stdout?.trim();
}
const occupied = run(['-Atc', "SELECT count(*) FROM pg_tables WHERE schemaname IN ('public','auth','storage')"], true);
if (occupied !== '0') throw new Error('Banco não está vazio. Testes recusados para preservar os dados.');
run(['-f', 'tests/fixtures/full-schema-platform.sql']);
for (const file of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) {
  run(['-f', `supabase/migrations/${file}`]);
}
// Simulate missing grants, then verify repair and idempotence.
run(['-c', 'REVOKE INSERT,UPDATE,DELETE ON public.mangas,public.volumes,public.pages,public.physical_shelf_books FROM authenticated; REVOKE EXECUTE ON FUNCTION public.booksyde_admin_set_account_type(uuid,text) FROM authenticated;']);
run(['-f', 'SQL_REPARAR_CRUD.sql', '-f', 'SQL_REPARAR_CRUD.sql']);
run(['-f', 'tests/database-flows.sql', '-f', 'tests/crud-permissions.sql']);
