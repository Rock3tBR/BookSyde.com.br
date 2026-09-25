const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
function api() {
  const values = new Map();
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/lib/readerPersonalization.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: () => ({}),
      Event,
      window: { dispatchEvent() {} },
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
    },
  );
  return exports;
}
test("preferências são comuns aos livros, mas isoladas entre contas", () => {
  const reader = api();
  reader.saveReaderPreferences("alice", {
    fontSize: 30,
    palette: "sepia",
    readingMode: "vertical",
  });
  assert.equal(reader.getReaderPreferences("alice").fontSize, 30);
  assert.equal(reader.getReaderPreferences("alice").palette, "sepia");
  assert.equal(reader.getReaderPreferences("bob").fontSize, 20);
  assert.equal(reader.getReaderPreferences().fontSize, 20);
});
test("500 páginas viram 1300 só para quem mediu, sem mudar PDFs nem o volume", () => {
  const reader = api();
  const volume = { id: "book", file_format: "epub", page_count: 500 };
  reader.savePersonalLayout("alice", "book", 1300, 649);
  assert.equal(reader.personalPageCount(volume, reader.getPersonalLayouts("alice")), 1300);
  assert.equal(reader.personalPageCount(volume, reader.getPersonalLayouts("bob")), 500);
  assert.equal(
    reader.personalPageCount({ ...volume, file_format: "pdf" }, reader.getPersonalLayouts("alice")),
    500,
  );
  assert.equal(volume.page_count, 500);
});
test("contagem temporária ou corrompida não substitui a paginação medida", () => {
  const reader = api();
  reader.savePersonalLayout("alice", "book", 1300, 649);
  for (const count of [0, -1, NaN, 1.5]) reader.savePersonalLayout("alice", "book", count, 0);
  assert.equal(reader.getPersonalLayouts("alice").book.pageCount, 1300);
});
