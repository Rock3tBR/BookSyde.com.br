import { strFromU8, unzip, zipSync } from "fflate";
import {
  validatePublicationFiles,
  validateVolumeCovers,
  type UnitKind,
  type WorkType,
} from "@/lib/publication";

export type BatchUnit = { file: File; cover: File | null; title: string; number: number };
export type BatchPublication = {
  title: string;
  description: string;
  categories: string[];
  synopsis: string;
  author: string;
  priceCents: number;
  isCollection: boolean;
  workType: WorkType;
  unitKind: UnitKind;
  cover: File | null;
  units: BatchUnit[];
};

export const naturalFileCompare = (a: string, b: string) =>
  a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const basename = (path: string) => path.split("/").at(-1)!;
const dirname = (path: string) => path.split("/").slice(0, -1).join("/");
const imagePattern = /\.(jpe?g|png|webp|gif)$/i;
const contentPattern = /\.(epub|pdf|cbz|cbr|zip|mobi|azw3?|prc)$/i;
const isCover = (path: string) => /^capa\.(jpe?g|png|webp|gif)$/i.test(basename(path));
function mime(name: string) {
  const extension = name.split(".").at(-1)?.toLowerCase();
  return (
    (
      {
        pdf: "application/pdf",
        epub: "application/epub+zip",
        zip: "application/zip",
        cbz: "application/vnd.comicbook+zip",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
      } as Record<string, string>
    )[extension ?? ""] ?? "application/octet-stream"
  );
}
const toFile = (path: string, bytes: Uint8Array) =>
  new File([new Uint8Array(bytes).buffer], basename(path), { type: mime(path) });

export function validateBatchPublication(work: BatchPublication) {
  if (!work.units.length) throw new Error(`${work.title}: adicione ao menos um arquivo.`);
  const numbers = work.units.map((unit) => unit.number);
  if (new Set(numbers).size !== numbers.length)
    throw new Error(`${work.title}: há números de capítulos ou volumes repetidos.`);
  for (const unit of work.units) validatePublicationFiles(work.workType, [unit.file], unit.number);
  validateVolumeCovers([work.cover, ...work.units.map((unit) => unit.cover)]);
  if (
    work.workType === "book" &&
    !work.isCollection &&
    (work.units.length !== 1 || numbers[0] !== 1)
  ) {
    throw new Error(`${work.title}: um livro individual precisa de um único arquivo no número 1.`);
  }
}

/** Moves the file and its cover together between the displayed numbered slots. */
export function moveBatchUnit(work: BatchPublication, index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= work.units.length) return work;
  const units = [...work.units];
  const current = units[index]!;
  const other = units[target]!;
  units[index] = { ...other, number: current.number };
  units[target] = { ...current, number: other.number };
  return { ...work, units };
}

export async function parsePublicationZip(
  file: File,
  defaultType: WorkType,
): Promise<BatchPublication[]> {
  if (!/\.zip$/i.test(file.name)) throw new Error("Selecione um arquivo .zip.");
  if (!file.size || file.size > 500 * 1024 * 1024)
    throw new Error("O ZIP deve ter conteúdo e no máximo 500 MB.");
  let expandedSize = 0;
  const compressed = new Uint8Array(await file.arrayBuffer());
  const unpacked = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(
      compressed,
      {
        filter(entry) {
          const parts = entry.name.replace(/\\/g, "/").split("/");
          if (parts.some((part) => part === "..") || entry.name.startsWith("/"))
            throw new Error("O ZIP contém um caminho inválido.");
          if (
            entry.name.endsWith("/") ||
            parts.some((part) => part.startsWith(".") || part === "__MACOSX")
          )
            return false;
          expandedSize += entry.originalSize;
          if (expandedSize > 1024 * 1024 * 1024)
            throw new Error("O conteúdo descompactado excede 1 GB. Divida em ZIPs menores.");
          return true;
        },
      },
      (error, files) => (error ? reject(error) : resolve(files)),
    );
  });
  const entries = Object.entries(unpacked).map(
    ([path, bytes]) => [path.replace(/\\/g, "/"), bytes] as const,
  );
  const at = (root: string, names: string[]) =>
    entries.find(([path]) => dirname(path) === root && names.includes(normalize(basename(path))));
  const text = (root: string, names: string[]) => {
    const entry = at(root, names);
    return entry
      ? strFromU8(entry[1])
          .replace(/^\uFEFF/, "")
          .trim()
      : "";
  };
  const coverAt = (root: string) => {
    const entry = entries.find(([path]) => dirname(path) === root && isCover(path));
    return entry ? toFile(entry[0], entry[1]) : null;
  };
  const roots = [
    ...new Set(
      entries
        .filter(([path]) => ["nome.txt", "titulo.txt"].includes(normalize(basename(path))))
        .map(([path]) => dirname(path)),
    ),
  ].sort(naturalFileCompare);
  if (!roots.length)
    throw new Error(
      "Nenhuma obra encontrada. Inclua uma pasta por obra com nome.txt e os demais metadados.",
    );
  const works: BatchPublication[] = [];
  for (const root of roots) {
    const location = root || file.name;
    const title = text(root, ["nome.txt", "titulo.txt"]);
    const description = text(root, ["descricao.txt"]);
    const categoriesText = text(root, ["categorias.txt", "categoria.txt"]);
    const synopsis = text(root, ["sinopse.txt"]);
    const author = text(root, ["escritor.txt", "autor.txt"]);
    const rawPrice = text(root, ["preco.txt"]);
    const rawType = normalize(text(root, ["tipo.txt"]));
    const workType = rawType
      ? (
          { manga: "manga", hq: "hq", gibi: "gibi", livro: "book", book: "book" } as Record<
            string,
            WorkType
          >
        )[rawType]
      : defaultType;
    if (!workType) throw new Error(`${location}: tipo.txt deve conter manga, hq, gibi ou livro.`);
    const rawCollection = normalize(text(root, ["colecao.txt"]));
    const missing = [
      ["nome.txt", title],
      ["descricao.txt", description],
      ["categorias.txt", categoriesText],
      ["sinopse.txt", synopsis],
      ["escritor.txt", author],
      ["preco.txt", rawPrice],
      ...(workType === "book" ? [["colecao.txt", rawCollection]] : []),
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);
    if (missing.length) throw new Error(`${location}: faltando ${missing.join(", ")}.`);
    if (
      rawCollection &&
      !["sim", "true", "1", "yes", "nao", "false", "0", "no"].includes(rawCollection)
    )
      throw new Error(`${location}: colecao.txt deve conter sim ou nao.`);
    const isCollection =
      workType === "manga" ? false : ["sim", "true", "1", "yes"].includes(rawCollection);
    const price = rawPrice.replace(/R\$/gi, "").replace(/\s/g, "");
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(price) && !/^\d+\.\d{1,2}$/.test(price))
      throw new Error(`${location}: preço inválido. Use 0 ou, por exemplo, 19,90.`);
    const priceCents = Math.round(
      Number(
        price.includes(",") || /\.\d{3}(?:\.|$)/.test(price)
          ? price.replace(/\./g, "").replace(",", ".")
          : price,
      ) * 100,
    );
    if (
      !Number.isSafeInteger(priceCents) ||
      priceCents > 2147483647 ||
      (priceCents > 0 && priceCents < 100)
    )
      throw new Error(
        `${location}: use preço zero ou pelo menos R$ 1,00, dentro do limite permitido.`,
      );
    const rawUnit = normalize(text(root, ["unidade.txt", "tipo_unidade.txt"]));
    const unitKind =
      workType === "book"
        ? "volume"
        : (
            { capitulo: "chapter", chapter: "chapter", volume: "volume" } as Record<
              string,
              UnitKind
            >
          )[rawUnit];
    if (!unitKind)
      throw new Error(`${location}: unidade.txt é obrigatório e deve conter capitulo ou volume.`);
    const prefix = root ? `${root}/` : "";
    const contents = entries.filter(
      ([path]) =>
        path.startsWith(prefix) &&
        !roots.some(
          (other) => other !== root && other.startsWith(prefix) && path.startsWith(`${other}/`),
        ),
    );
    const candidates: Array<{ path: string; file: File; cover: File | null; title: string }> = [];
    for (const [path, bytes] of contents.filter(([path]) => contentPattern.test(path))) {
      const directory = dirname(path);
      const nestedTitle =
        directory !== root &&
        !["colecoes", "volumes", "capitulos", "arquivos"].includes(normalize(basename(directory)))
          ? basename(directory)
          : basename(path).replace(/\.[^.]+$/, "");
      const suppliedCover = contents.find(
        ([name]) =>
          dirname(name) === directory &&
          imagePattern.test(name) &&
          normalize(name.replace(/\.[^.]+$/, "")) === normalize(path.replace(/\.[^.]+$/, "")),
      );
      const filename = `${nestedTitle}.${basename(path).split(".").at(-1)}`;
      candidates.push({
        path,
        file: toFile(filename, bytes),
        cover: suppliedCover ? toFile(suppliedCover[0], suppliedCover[1]) : coverAt(directory),
        title: nestedTitle,
      });
    }
    if (workType !== "book") {
      // A folder of numbered images is one chapter/volume; package it as CBZ.
      const folders = new Map<string, Array<readonly [string, Uint8Array]>>();
      for (const entry of contents.filter(([path]) => imagePattern.test(path) && !isCover(path))) {
        const directory = dirname(entry[0]);
        if (directory === root || candidates.some((item) => dirname(item.path) === directory))
          continue;
        folders.set(directory, [...(folders.get(directory) ?? []), entry]);
      }
      for (const [directory, images] of folders) {
        const name = `${basename(directory)}.cbz`;
        const bytes = zipSync(
          Object.fromEntries(images.map(([path, data]) => [basename(path), data])),
          { level: 0 },
        );
        candidates.push({
          path: `${directory}/${name}`,
          file: toFile(name, bytes),
          cover: coverAt(directory),
          title: basename(directory),
        });
      }
    }
    candidates.sort(
      (a, b) => naturalFileCompare(a.title, b.title) || naturalFileCompare(a.path, b.path),
    );
    if (!candidates.length) throw new Error(`${location}: nenhum arquivo de leitura encontrado.`);
    if (workType === "book" && !isCollection && candidates.length !== 1)
      throw new Error(`${location}: livro unitário deve possuir exatamente um EPUB ou PDF.`);
    const units = candidates.map((item, index) => {
      const match = item.title.match(/\d+/g);
      const number = workType === "book" ? index + 1 : match ? Number(match.at(-1)) : index + 1;
      return { file: item.file, cover: item.cover, title: item.title, number };
    });
    const work = {
      title,
      description,
      categories: categoriesText
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      synopsis,
      author,
      priceCents,
      isCollection,
      workType,
      unitKind,
      cover: coverAt(root),
      units,
    };
    validateBatchPublication(work);
    works.push(work);
  }
  return works;
}

export async function prepareBatchCovers(works: BatchPublication[]) {
  const { extractEpubCover } = await import("@/lib/epub");
  const { extractPages } = await import("@/lib/mangaFile");
  const { createPageThumbnail } = await import("@/lib/imageProcessing");
  for (const work of works) {
    for (const unit of work.units) {
      if (unit.cover) continue;
      if (/\.epub$/i.test(unit.file.name)) unit.cover = await extractEpubCover(unit.file);
      if (!unit.cover && work.workType === "book" && /\.epub$/i.test(unit.file.name))
        unit.cover = work.cover;
      if (!unit.cover) {
        if (work.workType === "book" && /\.epub$/i.test(unit.file.name))
          throw new Error(`${unit.file.name}: inclua capa.jpg ou uma capa no EPUB.`);
        const [page] = await extractPages(unit.file, { maxPages: 1 });
        if (!page)
          throw new Error(`${unit.file.name}: nenhuma página encontrada para gerar a capa.`);
        const cover = await createPageThumbnail(page);
        unit.cover = new File([new Uint8Array(cover.bytes).buffer], `${unit.title}.jpg`, {
          type: cover.type,
        });
      }
    }
    work.cover ??= work.units[0]?.cover ?? null;
    validateBatchPublication(work);
  }
  return works;
}
