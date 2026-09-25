const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setup() {
  const state = { token: 'alice', now: 0, rpcCalls: 0, batches: [], fail: false, allowed: ['1', '2', '3', '4'] };
  const modules = new Map();
  const supabase = {
    auth: { getSession: async () => ({ data: { session: state.token ? { access_token: state.token } : null } }) },
    rpc: async () => {
      state.rpcCalls++;
      return { data: state.allowed.map(storage_path => ({ storage_path })) };
    },
    storage: { from: () => ({ createSignedUrls: async paths => {
      state.batches.push(Array.from(paths));
      if (state.fail) return { error: { message: 'temporarily unavailable' } };
      return { data: paths.map(path => ({ signedUrl: `${state.token}/${path}` })) };
    } }) },
  };
  function load(name) {
    if (name === '@/integrations/supabase/client') return { supabase };
    if (modules.has(name)) return modules.get(name);
    const exports = {};
    modules.set(name, exports);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(`src/${name.slice(2)}.ts`, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, require: load, window: {}, Date: { now: () => state.now } });
    return exports;
  }
  return { state, ...load('@/lib/readerAccess'), ...load('@/lib/readerPages'), ...load('@/lib/readerCache') };
}

test('manifest already loaded by reader is reused; overlapping chunks only sign new pages', async () => {
  const api = setup();
  await api.getReaderPages(['book']);
  await api.signReaderPages('book', ['1', '2', '2']);
  const urls = await api.signReaderPages('book', ['2', '3']);
  assert.equal(api.state.rpcCalls, 1);
  assert.deepEqual(api.state.batches, [['1', '2'], ['3']]);
  assert.equal(urls['2'], 'alice/2');
  assert.equal(urls['3'], 'alice/3');
});

test('simultaneous readers share requests and in-flight page URLs', async () => {
  const api = setup();
  await Promise.all([api.signReaderPages('book', ['1', '2']), api.signReaderPages('book', ['2', '3'])]);
  assert.equal(api.state.rpcCalls, 1);
  assert.deepEqual(api.state.batches, [['1', '2'], ['3']]);
});

test('sign out and account/token change never reuse another session URLs', async () => {
  const api = setup();
  await api.signReaderPages('book', ['1']);
  api.state.token = 'bob';
  assert.equal((await api.signReaderPages('book', ['1']))['1'], 'bob/1');
  api.state.token = null;
  await api.signReaderPages('book', ['1']);
  assert.equal(api.state.rpcCalls, 3);
  assert.equal(api.state.batches.length, 3);
});

test('permissions are rechecked after TTL even when signed URLs remain cached', async () => {
  const api = setup();
  await api.signReaderPages('book', ['1']);
  api.state.allowed = [];
  api.state.now = 60_001;
  await assert.rejects(api.signReaderPages('book', ['1']), /permissão/);
  assert.equal(api.state.rpcCalls, 2);
  assert.equal(api.state.batches.length, 1);
});

test('failed signing can be retried and never poisons the cache', async () => {
  const api = setup();
  api.state.fail = true;
  await assert.rejects(api.signReaderPages('book', ['1', '2']), /unavailable/);
  api.state.fail = false;
  assert.equal((await api.signReaderPages('book', ['1']))['1'], 'alice/1');
  assert.equal(api.state.batches.length, 2);
});

test('signed URLs expire locally before the server expiration', async () => {
  const api = setup();
  await api.signReaderPages('book', ['1']);
  api.state.now = 300_001;
  await api.signReaderPages('book', ['1']);
  assert.equal(api.state.batches.length, 2);
});

test('page filters and different books do not share manifests', async () => {
  const api = setup();
  await api.getReaderPages(['book'], 0);
  await api.getReaderPages(['book']);
  await api.getReaderPages(['other']);
  assert.equal(api.state.rpcCalls, 3);
});

test('memory cache evicts entries beyond its limit', () => {
  const { ReaderCache } = setup();
  const cache = new ReaderCache(1000, 2);
  cache.set('first', Promise.resolve(1));
  cache.set('second', Promise.resolve(2));
  cache.set('third', Promise.resolve(3));
  assert.equal(cache.get('first'), undefined);
  assert.ok(cache.get('second'));
});

function proxy(upstream) {
  const exports = {};
  const calls = [];
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/routes/api.reader-pages.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Response, Headers, URL, console, require(name) {
    if (name === '@tanstack/react-router') return { createFileRoute: () => config => config };
    if (name === '@/lib/drive.server') return {
      validateDriveProxy: () => true,
      fetchDriveFile: async (...args) => { calls.push(args); return upstream; },
    };
    throw new Error(name);
  } });
  return { run: exports.Route.server.handlers.GET, calls };
}

test('Drive proxy preserves partial responses, byte ranges and cancellation', async () => {
  const { run, calls } = proxy(new Response('part', { status: 206, headers: { 'content-range': 'bytes 0-3/100', 'accept-ranges': 'bytes' } }));
  const request = new Request('https://book.test/api/reader-pages?fileId=file', { headers: { Range: 'bytes=0-3' } });
  const response = await run({ request });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), 'bytes 0-3/100');
  assert.equal(calls[0][1], 'bytes=0-3');
  assert.equal(calls[0][2], request.signal);
});

test('Drive proxy does not invent range support and forwards unsatisfiable ranges', async () => {
  const request = new Request('https://book.test/api/reader-pages');
  const whole = await proxy(new Response('whole')).run({ request });
  assert.equal(whole.headers.get('accept-ranges'), null);
  const invalid = await proxy(new Response(null, { status: 416, headers: { 'content-range': 'bytes */100' } })).run({ request });
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers.get('content-range'), 'bytes */100');
});
