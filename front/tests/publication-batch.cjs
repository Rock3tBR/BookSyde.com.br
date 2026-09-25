const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { zipSync, strToU8, unzipSync } = require("fflate");
function load(name) {
  const exports = {};
  const compiled = ts.transpileModule(fs.readFileSync(`src/lib/${name}.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    File,
    Uint8Array,
    require: (name) => (name === "fflate" ? require("fflate") : load(name.split("/").pop())),
  });
  return exports;
}
const { parsePublicationZip, moveBatchUnit, validateBatchPublication } = load("publicationBatch");
const { resolveVolumeNumbers } = load("publication");
const metadata = (root, extra = {}) =>
  Object.fromEntries(
    Object.entries({
      "nome.txt": "Minha obra",
      "descricao.txt": "Descrição",
      "categorias.txt": "Aventura, Fantasia",
      "sinopse.txt": "Sinopse",
      "escritor.txt": "Autora",
      "preco.txt": "19,90",
      "unidade.txt": "capítulo",
      ...extra,
    })
      .filter(([, value]) => value !== null)
      .map(([name, value]) => [`${root}/${name}`, strToU8(value)]),
  );
const archive = (entries) => new File([zipSync(entries)], "obras.zip", { type: "application/zip" });
const entries = (root, names) =>
  Object.fromEntries(names.map((name) => [`${root}/${name}`, strToU8("%PDF-1.4 content")]));

test("mangá, HQ e gibi preservam números e usam ordem natural 3, 4, 5, 10", async () => {
  for (const type of ["manga", "hq", "gibi"]) {
    const [work] = await parsePublicationZip(
      archive({ ...metadata("Obra"), ...entries("Obra", ["10.pdf", "5.pdf", "3.pdf", "4.pdf"]) }),
      type,
    );
    assert.equal(work.workType, type);
    assert.equal(work.unitKind, "chapter");
    assert.equal(work.priceCents, 1990);
    assert.deepEqual(
      Array.from(work.units, (unit) => [unit.file.name, unit.number]),
      [
        ["3.pdf", 3],
        ["4.pdf", 4],
        ["5.pdf", 5],
        ["10.pdf", 10],
      ],
    );
  }
});

test("tipo e unidade individuais permitem misturar obras no ZIP", async () => {
  const works = await parsePublicationZip(
    archive({
      ...metadata("Pacote/HQ", { "tipo.txt": "hq", "unidade.txt": "volume" }),
      ...entries("Pacote/HQ", ["0.cbz"]),
      ...metadata("Pacote/Gibi", { "tipo.txt": "gibi" }),
      ...entries("Pacote/Gibi", ["2.pdf"]),
    }),
    "book",
  );
  assert.deepEqual(
    Array.from(works, (work) => [work.workType, work.unitKind, work.units[0].number]),
    [
      ["gibi", "chapter", 2],
      ["hq", "volume", 0],
    ],
  );
});

test("coleção antiga EPUB e PDF mantém nomes de pastas e ordenação natural", async () => {
  const [work] = await parsePublicationZip(
    archive({
      ...metadata("Coleção", { "colecao.txt": "sim", "unidade.txt": null }),
      ...entries("Coleção/colecoes/10", ["livro.pdf"]),
      ...entries("Coleção/colecoes/2", ["livro.epub"]),
    }),
    "book",
  );
  assert.deepEqual(
    Array.from(work.units, (unit) => [unit.file.name, unit.number]),
    [
      ["2.epub", 1],
      ["10.pdf", 2],
    ],
  );
  assert.equal(work.isCollection, true);
});

test("livro individual também pode ser PDF e continua no número 1", async () => {
  const [work] = await parsePublicationZip(
    archive({ ...metadata("Livro", { "colecao.txt": "nao" }), ...entries("Livro", ["1984.pdf"]) }),
    "book",
  );
  assert.equal(work.units[0].number, 1);
  assert.equal(work.units[0].file.type, "application/pdf");
});

test("pastas de imagens viram capítulos CBZ sem incluir capas", async () => {
  const [work] = await parsePublicationZip(
    archive({
      ...metadata("Obra"),
      "Obra/capitulos/10/10.png": strToU8("imagem10"),
      "Obra/capitulos/10/2.png": strToU8("imagem2"),
      "Obra/capitulos/10/capa.jpg": strToU8("capa"),
      "Obra/capitulos/3/1.png": strToU8("imagem1"),
      "__MACOSX/._Obra": strToU8("ignore"),
      "Obra/.DS_Store": strToU8("ignore"),
    }),
    "manga",
  );
  assert.deepEqual(
    Array.from(work.units, (unit) => unit.number),
    [3, 10],
  );
  assert.equal(work.units[1].cover.name, "capa.jpg");
  assert.deepEqual(
    Object.keys(unzipSync(new Uint8Array(await work.units[1].file.arrayBuffer()))).sort(),
    ["10.png", "2.png"],
  );
});

test("reordenar mantém a capa com o arquivo e troca os números das posições", async () => {
  const [work] = await parsePublicationZip(
    archive({
      ...metadata("Obra"),
      ...entries("Obra", ["3.pdf", "10.pdf"]),
      "Obra/3.jpg": strToU8("capa3"),
      "Obra/10.jpg": strToU8("capa10"),
    }),
    "hq",
  );
  const reordered = moveBatchUnit(work, 1, -1);
  assert.deepEqual(
    Array.from(reordered.units, (unit) => [unit.file.name, unit.cover.name, unit.number]),
    [
      ["10.pdf", "10.jpg", 3],
      ["3.pdf", "3.jpg", 10],
    ],
  );
  assert.equal(work.units[0].file.name, "3.pdf");
});

test("rejeita unidade ausente/inválida, metadados incompletos e nomes com números repetidos", async () => {
  for (const unit of [null, "episodio"]) {
    await assert.rejects(
      parsePublicationZip(
        archive({ ...metadata("Obra", { "unidade.txt": unit }), ...entries("Obra", ["3.pdf"]) }),
        "manga",
      ),
      /unidade.txt/,
    );
  }
  await assert.rejects(
    parsePublicationZip(
      archive({ ...metadata("Obra", { "sinopse.txt": null }), ...entries("Obra", ["3.pdf"]) }),
      "hq",
    ),
    /sinopse.txt/,
  );
  await assert.rejects(
    parsePublicationZip(
      archive({ ...metadata("Obra"), ...entries("Obra", ["3.pdf", "3.cbz"]) }),
      "gibi",
    ),
    /repetidos/,
  );
});

test("números editados e fila rejeitam duplicados, negativos e frações", async () => {
  const [work] = await parsePublicationZip(
    archive({ ...metadata("Obra"), ...entries("Obra", ["1.pdf", "2.pdf"]) }),
    "hq",
  );
  const files = Array.from(work.units, (unit) => unit.file);
  assert.deepEqual(Array.from(resolveVolumeNumbers(files, 1, [3, 10])), [3, 10]);
  for (const numbers of [[1, 1], [1, -2], [1, 1.5], [1], [1, NaN]]) {
    assert.throws(() => resolveVolumeNumbers(files, 1, numbers));
  }
  work.units[0].number = -1;
  assert.throws(() => validateBatchPublication(work), /número inteiro/);
});

test("rejeita arquivo vazio, caminho inseguro, PDF em livro sem metadados e formato de quadrinhos em livro", async () => {
  await assert.rejects(
    parsePublicationZip(archive({ ...metadata("Obra"), "Obra/3.pdf": new Uint8Array() }), "hq"),
    /vazio/,
  );
  await assert.rejects(
    parsePublicationZip(archive({ "../nome.txt": strToU8("fora") }), "hq"),
    /caminho inválido/,
  );
  await assert.rejects(
    parsePublicationZip(
      archive({ ...metadata("Livro"), ...entries("Livro", ["livro.pdf"]) }),
      "book",
    ),
    /colecao.txt/,
  );
  await assert.rejects(
    parsePublicationZip(
      archive({
        ...metadata("Livro", { "colecao.txt": "nao" }),
        ...entries("Livro", ["livro.cbr"]),
      }),
      "book",
    ),
    /apenas EPUB ou PDF/,
  );
});
