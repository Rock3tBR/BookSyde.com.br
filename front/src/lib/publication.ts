export const WORK_TYPES = [
  { value: "manga", label: "Mangás" },
  { value: "hq", label: "HQs" },
  { value: "gibi", label: "Gibis" },
  { value: "book", label: "Livros" },
] as const;
export type WorkType = (typeof WORK_TYPES)[number]["value"];
export type UnitKind = "volume" | "chapter";
export const unitLabel = (kind: string) => (kind === "chapter" ? "Capítulo" : "Volume");

const BOOK_FORMATS = /\.(epub|pdf)$/i;
const COMIC_FORMATS = /\.(pdf|cbr|cbz|zip|epub|mobi|azw3?|prc)$/i;
const MAX_FILE_SIZE = 500 * 1024 * 1024;

export function validatePublicationFiles(type: WorkType, files: File[], firstNumber: number) {
  if (!Number.isSafeInteger(firstNumber) || firstNumber < 0 || firstNumber + files.length - 1 > 2147483647) {
    throw new Error("Informe um número inteiro entre 0 e 2147483647, considerando todos os arquivos do lote.");
  }
  if (!files.length) throw new Error("Selecione ao menos um arquivo para publicar.");
  if (type !== "book" && type !== "manga" && type !== "hq" && type !== "gibi") {
    throw new Error("Tipo de obra inválido.");
  }
  for (const file of files) {
    if (!file.size) throw new Error(`${file.name} está vazio.`);
    if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name} excede o limite de 500 MB.`);
    if (!(type === "book" ? BOOK_FORMATS : COMIC_FORMATS).test(file.name)) {
      throw new Error(type === "book"
        ? `${file.name}: livros aceitam apenas EPUB ou PDF.`
        : `${file.name}: use PDF, CBR, CBZ, ZIP, EPUB, MOBI, AZW/AZW3 ou PRC.`);
    }
  }
}

export function validateVolumeCovers(covers: Array<File | null>) {
  for (const cover of covers) {
    if (!cover) continue;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(cover.type) || cover.size === 0 || cover.size > 10 * 1024 * 1024) {
      throw new Error(`Capa inválida (${cover.name}). Use JPG, PNG, WebP ou GIF de até 10 MB.`);
    }
  }
}

export function resolveVolumeNumbers(files: File[], firstNumber: number, numbers?: number[]) {
  const result = numbers ? [...numbers] : files.map((_, index) => firstNumber + index);
  if (result.length !== files.length || result.some((value) => !Number.isSafeInteger(value) || value < 0 || value > 2147483647)) {
    throw new Error("Informe um número inteiro entre 0 e 2147483647 para cada arquivo.");
  }
  if (new Set(result).size !== result.length) throw new Error("Há números de capítulos ou volumes repetidos no lote.");
  return result;
}
