// Execute: node tests/social-search-regression.cjs
// Testes isolados: não substituem as verificações RLS no Supabase real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let ts;
try { ts = require('typescript'); } catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
let mockRpc = async () => ({ data: [], error: null });
const mockDb = {
  rpc: (...args) => mockRpc(...args),
  from() { throw new Error('Fallback não esperado para este caso'); },
};
const source = read('src/lib/socialSearch.ts');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const api = {};
vm.runInNewContext(compiled, {
  exports: api, require: (name) => {
    assert.equal(name, '@/integrations/supabase/client');
    return { supabase: mockDb };
  },
  Error,
});

async function main() {
  assert.equal(api.normalizeReaderSearch('  # AbC12345  '), 'AbC12345');
  assert.equal(api.normalizeReaderSearch('  Maria    Silva  '), 'Maria Silva');
  assert.equal(api.normalizeReaderSearch('  #  1a2B  '), '1a2B');
  assert.equal(api.normalizeReaderSearch(' X '.repeat(70)).length, 63);
  let calls = 0;
  mockRpc = async (name, args) => {
    calls += 1;
    assert.equal(name, 'search_readers');
    assert.equal(args._query, 'ABC12345');
    assert.equal(args._max_results, 12);
    return { data: [{ id: 'other', display_name: 'Pessoa', avatar_url: null, user_code: 'ABC12345' }], error: null };
  };
  const code = await api.searchReaders(' #ABC12345 ', 'mine', 100);
  assert.equal(code.profiles.length, 1);
  assert.equal(code.needsMigration, false);
  assert.equal(calls, 1);
  const empty = await api.searchReaders('a', 'mine');
  assert.equal(empty.profiles.length, 0);
  assert.equal(calls, 1);
  mockRpc = async () => ({ data: null, error: { code: '42501', message: 'Permissão negada' } });
  await assert.rejects(api.searchReaders('Maria', 'mine'), /Permissão negada/);
  mockRpc = async (name, args) => {
    assert.equal(name, 'get_reader_profiles');
    assert.deepEqual(Array.from(args._ids), ['friend']);
    return { data: [{ id: 'friend', display_name: 'Amigo', avatar_url: null, user_code: null }], error: null };
  };
  const contacts = await api.getReaderProfiles(['friend']);
  assert.equal(contacts.length, 1);
  assert.equal((await api.getReaderProfiles([])).length, 0);

  const header = read('src/components/SiteHeader.tsx');
  assert.match(header, /case "admin":\s*return \[home, marketplace, studio, library, admin\]/);
  assert.match(header, /case "seller":\s*return \[home, marketplace, studio, library, seller, plans, personalization\]/);
  assert.match(header, /case "editora":\s*return \[home, dashboard, studio, library, publisher\]/);
  assert.match(header, /case "creator":\s*return \[home, marketplace, studio, library, favorites, plans, personalization\]/);
  assert.match(header, /return \[home, marketplace, plans\]/);
  assert.match(read('src/pages/admin.tsx'), /<StudioNavigation current=\{studioSection\}/);
  assert.doesNotMatch(read('src/pages/admin.tsx'), /grid-cols-3 gap-1 rounded-\[1\.1rem\]/);
  for (const f of ['src/pages/social.tsx', 'src/components/CommunityDock.tsx']) {
    assert.match(read(f), /searchReaders\(normalizedSearch/);
    assert.doesNotMatch(read(f), /display_name\.ilike\.\%/);
  }
  const sql = read('supabase/migrations/20260916150000_reader_discovery.sql');
  assert.match(sql, /security definer/g);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /revoke all on function public\.search_readers/);
  assert.match(sql, /grant execute on function public\.get_reader_profiles/);
  console.log('PASS: busca por nome/código, erro explícito, perfis de contato, menu Estúdio, planos por papel e contrato SQL (testes isolados)');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
