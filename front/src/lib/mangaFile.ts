import { unzipSync } from "fflate";

export type ExtractedPage = {
  name: string;
  bytes: Uint8Array;
  type: string;
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const MIN_IMAGE_BYTES = 6 * 1024;

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function mimeFor(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/** CBZ / ZIP / EPUB: pull every image entry, ordered naturally by file name. */
function fromZip(buffer: Uint8Array): ExtractedPage[] {
  const files = unzipSync(buffer);
  return Object.keys(files)
    .filter((name) => IMAGE_EXT.test(name) && !name.startsWith("__MACOSX"))
    .sort(naturalCompare)
    .map((name) => ({ name, bytes: files[name]!, type: mimeFor(name) }))
    .filter((page) => page.bytes.length > 0);
}


async function fromRar(file: File): Promise<ExtractedPage[]> {
  // O suporte CBR fica fora do bundle principal para não quebrar o build do Lovable.
  // node-unrar-js usa o UnRAR oficial compilado para WebAssembly e funciona com RAR4/RAR5.
  const moduleUrl = "https://esm.sh/node-unrar-js@2.0.2/esm";
  const wasmUrl = "https://cdn.jsdelivr.net/npm/node-unrar-js@2.0.2/esm/js/unrar.wasm";

  type RarModule = {
    createExtractorFromData?: (options: {
      data: ArrayBuffer;
      wasmBinary?: ArrayBuffer;
      password?: string;
    }) => Promise<any>;
  };

  let createExtractorFromData: RarModule["createExtractorFromData"];
  let wasmBinary: ArrayBuffer;

  try {
    const [rarModule, wasmResponse] = await Promise.all([
      import(/* @vite-ignore */ moduleUrl) as Promise<RarModule>,
      fetch(wasmUrl, { mode: "cors", cache: "force-cache" }),
    ]);

    createExtractorFromData = rarModule.createExtractorFromData;
    if (!createExtractorFromData) {
      throw new Error("createExtractorFromData não foi exportado pelo leitor RAR.");
    }
    if (!wasmResponse.ok) {
      throw new Error(`WASM do leitor RAR retornou HTTP ${wasmResponse.status}.`);
    }
    wasmBinary = await wasmResponse.arrayBuffer();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Não foi possível inicializar o leitor CBR/RAR: ${detail}`);
  }

  try {
    const data = await file.arrayBuffer();
    const extractor = await createExtractorFromData({ data, wasmBinary });

    // Percorre a lista inteira (exigência da biblioteca para liberar os objetos nativos)
    // e já descobre se o arquivo é protegido por senha.
    const listed = extractor.getFileList();
    const headers = [...listed.fileHeaders];
    const imageNames = headers
      .filter((header: any) => {
        const name = String(header?.name ?? "");
        return !header?.flags?.directory && IMAGE_EXT.test(name) && !name.startsWith("__MACOSX");
      })
      .map((header: any) => String(header.name));

    if (!imageNames.length) {
      throw new Error("O CBR/RAR não contém imagens compatíveis.");
    }

    const extracted = extractor.extract({ files: imageNames });
    const files = [...extracted.files];
    const pages: ExtractedPage[] = [];

    for (const item of files) {
      const name = String(item?.fileHeader?.name ?? "");
      const raw = item?.extraction;
      if (!IMAGE_EXT.test(name) || !raw) continue;
      const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      if (bytes.length < MIN_IMAGE_BYTES) continue;
      pages.push({ name, bytes, type: mimeFor(name) });
    }

    if (!pages.length) {
      const encrypted = headers.some((header: any) => header?.flags?.encrypted);
      throw new Error(
        encrypted
          ? "O CBR/RAR é protegido por senha e não pôde ser extraído."
          : "As imagens do CBR/RAR não puderam ser extraídas.",
      );
    }

    return pages.sort((a, b) => naturalCompare(a.name, b.name));
  } catch (error) {
    const detail = error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : (() => {
            try { return JSON.stringify(error); } catch { return String(error); }
          })();
    throw new Error(`Falha ao extrair ${file.name}: ${detail}`);
  }
}

/**
 * MOBI / AZW3 (KCC output): image records are stored as raw JPEG/PNG blobs
 * inside the PalmDB container, so we scan the binary for image signatures.
 */
function fromBinaryScan(buffer: Uint8Array): ExtractedPage[] {
  const pages: ExtractedPage[] = [];
  let i = 0;

  while (i < buffer.length - 8) {
    // JPEG: FF D8 FF ... FF D9
    if (buffer[i] === 0xff && buffer[i + 1] === 0xd8 && buffer[i + 2] === 0xff) {
      let j = i + 2;
      while (j < buffer.length - 1) {
        if (buffer[j] === 0xff && buffer[j + 1] === 0xd9) {
          j += 2;
          break;
        }
        j += 1;
      }
      const bytes = buffer.subarray(i, j);
      if (bytes.length >= MIN_IMAGE_BYTES) {
        pages.push({ name: `page-${pages.length}.jpg`, bytes, type: "image/jpeg" });
      }
      i = j;
      continue;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A ... IEND
    if (
      buffer[i] === 0x89 &&
      buffer[i + 1] === 0x50 &&
      buffer[i + 2] === 0x4e &&
      buffer[i + 3] === 0x47
    ) {
      let j = i + 8;
      while (j < buffer.length - 8) {
        if (
          buffer[j] === 0x49 &&
          buffer[j + 1] === 0x45 &&
          buffer[j + 2] === 0x4e &&
          buffer[j + 3] === 0x44
        ) {
          j += 8;
          break;
        }
        j += 1;
      }
      const bytes = buffer.subarray(i, j);
      if (bytes.length >= MIN_IMAGE_BYTES) {
        pages.push({ name: `page-${pages.length}.png`, bytes, type: "image/png" });
      }
      i = j;
      continue;
    }

    i += 1;
  }

  return pages;
}

async function fromPdf(buffer: Uint8Array, maxPages = Infinity): Promise<ExtractedPage[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const pages: ExtractedPage[] = [];
  try {
    for (let number = 1; number <= Math.min(pdf.numPages, maxPages); number++) {
      const page = await pdf.getPage(number);
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(2, 3200 / Math.max(original.width, original.height)),
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("Falha ao converter página PDF."))),
          "image/png",
        ),
      );
      pages.push({
        name: `page-${number}.png`,
        type: "image/png",
        bytes: new Uint8Array(await blob.arrayBuffer()),
      });
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages;
}

export async function extractPages(file: File, { maxPages = Infinity }: { maxPages?: number } = {}): Promise<ExtractedPage[]> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (strIsPdf(buffer)) return fromPdf(buffer, maxPages);
  if (/\.pdf$/i.test(file.name)) throw new Error("O arquivo não é um PDF válido.");
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isRar =
    buffer[0] === 0x52 &&
    buffer[1] === 0x61 &&
    buffer[2] === 0x72 &&
    buffer[3] === 0x21 &&
    buffer[4] === 0x1a &&
    buffer[5] === 0x07;

  const pages = isZip
    ? fromZip(buffer)
    : isRar
      ? await fromRar(file)
      : fromBinaryScan(buffer);

  if (!pages.length) {
    throw new Error(
      "Nenhuma página foi encontrada no arquivo. Use PDF, CBR, CBZ, ZIP, EPUB, MOBI, AZW/AZW3 ou PRC.",
    );
  }
  return pages.slice(0, maxPages);
}

export function usesBinaryImageOrder(file: File) {
  return /\.(?:mobi|azw3?|prc)$/i.test(file.name);
}

export function padIndex(index: number) {
  return String(index).padStart(4, "0");
}

function strIsPdf(buffer: Uint8Array) {
  return new TextDecoder().decode(buffer.subarray(0, 5)) === "%PDF-";
}
