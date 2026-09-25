const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function handler(file, method, db) {
  const exports = {};
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, Response, Set,
    require(name) {
      if (name === '@tanstack/react-router') return { createFileRoute: () => (config) => config };
      assert.equal(name, '@/integrations/supabase/request-client.server');
      return { createRequestClient: (token) => { db.token = token; return db; } };
    },
  });
  return exports.Route.server.handlers[method];
}
const request = (body, token = 'user-token') => new Request('https://example.invalid/api', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});

test('leitura rejeita caminhos que não pertencem às páginas autorizadas', async () => {
  const db = { rpc: async () => ({ data: [{ storage_path: 'allowed' }], error: null }) };
  const run = handler('src/routes/api.reader-pages.ts', 'POST', db);
  const response = await run({ request: request({ volumeId: 'v', paths: ['other'] }) });
  assert.equal(response.status, 403);
  assert.equal(db.token, 'user-token');
});

test('leitura assina somente páginas liberadas, sem chave administrativa', async () => {
  let signed;
  const db = {
    rpc: async () => ({ data: [{ storage_path: 'allowed' }], error: null }),
    storage: { from(bucket) {
      assert.equal(bucket, 'manga-pages');
      return { createSignedUrls: async (paths) => {
        signed = Array.from(paths);
        return { data: [{ signedUrl: 'https://signed.invalid/page' }], error: null };
      } };
    } },
  };
  const run = handler('src/routes/api.reader-pages.ts', 'POST', db);
  const response = await run({ request: request({ volumeId: 'v', paths: ['allowed'] }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(signed, ['allowed']);
  assert.deepEqual(await response.json(), { urls: { allowed: 'https://signed.invalid/page' } });
});

test('EPUB negado pelo banco não é assinado', async () => {
  const db = { rpc: async () => ({ data: null, error: null }) };
  const run = handler('src/routes/api.reader-pages.ts', 'POST', db);
  assert.equal((await run({ request: request({ volumeId: 'v', epub: true }) })).status, 403);
});

test('exclusão exige sessão válida antes de chamar o banco', async () => {
  const db = { auth: { getUser: async () => ({ data: { user: null }, error: new Error() }) } };
  const run = handler('src/routes/api.admin-mangas.ts', 'DELETE', db);
  assert.equal((await run({ request: request({ mangaId: 'm' }, '') })).status, 401);
  assert.equal((await run({ request: request({ mangaId: 'm' }) })).status, 401);
});

test('exclusão recusada por RLS/RPC não tenta remover arquivos', async () => {
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
    rpc: async () => ({ error: { code: '42501', message: 'Sem permissão' } }),
  };
  const run = handler('src/routes/api.admin-mangas.ts', 'DELETE', db);
  assert.equal((await run({ request: request({ mangaId: 'm' }) })).status, 403);
});

test('exclusão confirmada permanece sucesso se a limpeza falhar por rede', async () => {
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
    rpc: async () => ({ data: { ok: true }, error: null }),
    from() { throw new Error('Network failure'); },
  };
  const run = handler('src/routes/api.admin-mangas.ts', 'DELETE', db);
  const response = await run({ request: request({ mangaId: 'm' }) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.ok(result.warning);
});

test('exclusão remove apenas os arquivos listados nos recibos privados', async () => {
  const removed = [];
  let cleared = false;
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
    rpc: async () => ({ data: { ok: true }, error: null }),
    from(table) {
      assert.equal(table, 'publication_cleanup');
      return {
        select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({
          data: cleared ? [] : [{ id: 'receipt', bucket_id: 'manga-pages', object_path: 'own/0.jpg' }], error: null,
        }) }) }) }),
        delete: () => ({ in: async (_column, ids) => { assert.deepEqual(Array.from(ids), ['receipt']); cleared = true; return { error: null }; } }),
      };
    },
    storage: { from: (bucket) => ({ remove: async (paths) => {
      removed.push([bucket, ...paths]); return { error: null };
    } }) },
  };
  const run = handler('src/routes/api.admin-mangas.ts', 'DELETE', db);
  const response = await run({ request: request({ volumeId: 'v' }) });
  assert.equal(response.status, 200);
  assert.deepEqual(removed, [['manga-pages', 'own/0.jpg']]);
  assert.equal((await response.json()).warning, null);
});
