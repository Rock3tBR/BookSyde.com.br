// Testes locais, sem credenciais nem conexão Supabase: npm run test:publication
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const filename = path.join(__dirname, '..', 'src', 'lib', 'publication.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const moduleExports = {};
vm.runInNewContext(compiled, { exports: moduleExports, File });
const { validatePublicationFiles, validateVolumeCovers } = moduleExports;
const fixture = (name, size = 64, type = '') => new File([new Uint8Array(size)], name, { type });

test('Livros aceitam EPUB e PDF', () => {
  assert.doesNotThrow(() => validatePublicationFiles('book', [fixture('a.epub'), fixture('b.PDF')], 1));
});
test('HQ, gibi e mangá aceitam formatos de quadrinhos e volume zero', () => {
  for (const workType of ['hq', 'gibi', 'manga']) {
    assert.doesNotThrow(() => validatePublicationFiles(workType, [fixture('volume.cbr'), fixture('volume.cbz')], 0));
  }
});
test('Livros rejeitam formatos que o leitor de livros não suporta', () => {
  assert.throws(() => validatePublicationFiles('book', [fixture('comic.cbr')], 1), /apenas EPUB ou PDF/);
});
test('Rejeita número negativo, fracionário ou estouro do inteiro no lote', () => {
  for (const number of [-1, 0.5, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => validatePublicationFiles('hq', [fixture('v.pdf')], number), /número inteiro/);
  }
  assert.throws(() => validatePublicationFiles('manga', [fixture('1.pdf'), fixture('2.pdf')], 2147483647), /número inteiro/);
});
test('Rejeita arquivo vazio e acima de 500 MB', () => {
  assert.throws(() => validatePublicationFiles('book', [fixture('a.epub', 0)], 1), /vazio/);
  assert.throws(() => validatePublicationFiles('book', [{ name: 'a.epub', size: 500*1024*1024+1 }], 1), /500 MB/);
});
test('Aceita capa JPG e rejeita SVG/HTML em bucket de capas', () => {
  assert.doesNotThrow(() => validateVolumeCovers([fixture('c.jpg', 64, 'image/jpeg')]));
  assert.throws(() => validateVolumeCovers([fixture('a.svg', 64, 'image/svg+xml')]), /Capa inválida/);
});
