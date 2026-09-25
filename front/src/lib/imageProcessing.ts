import type { ExtractedPage } from "@/lib/mangaFile";

export type MangaProcessingMode = "auto" | "manga" | "original";

export type MangaProcessingOptions = {
  mode: MangaProcessingMode;
  removeMargins: boolean;
  maxDimension: number;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

type Crop = { x: number; y: number; width: number; height: number };

const SPREAD_RATIO = 1.35;

export async function processMangaPages(
  pages: ExtractedPage[],
  options: MangaProcessingOptions,
  onProgress?: (completed: number, total: number) => void,
) {
  if (options.mode === "original") return pages;
  const processed: ExtractedPage[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex]!;
    if (page.type === "image/gif") {
      processed.push(page);
      onProgress?.(pageIndex + 1, pages.length);
      continue;
    }

    const decoded = await decodeImage(page);
    try {
      const isSpread = decoded.width / decoded.height >= SPREAD_RATIO;
      const segments: Crop[] = isSpread
        ? splitSpread(decoded.width, decoded.height, options.mode === "manga")
        : [{ x: 0, y: 0, width: decoded.width, height: decoded.height }];

      for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
        const segment = segments[segmentIndex]!;
        const crop = options.removeMargins ? detectContentBounds(decoded.source, segment) : segment;
        const optimized = await renderOptimizedPage(decoded.source, crop, options.maxDimension);
        const canKeepOriginal =
          !isSpread &&
          crop.x === 0 &&
          crop.y === 0 &&
          crop.width === decoded.width &&
          crop.height === decoded.height &&
          Math.max(decoded.width, decoded.height) <= options.maxDimension &&
          (page.type === "image/jpeg" || page.type === "image/webp") &&
          page.bytes.byteLength <= optimized.bytes.byteLength;

        processed.push(
          canKeepOriginal
            ? page
            : {
                name: replaceExtension(
                  `${page.name.replace(/\.[^.]+$/, "")}${isSpread ? `-${segmentIndex + 1}` : ""}`,
                  optimized.type,
                ),
                bytes: optimized.bytes,
                type: optimized.type,
              },
        );
      }
    } finally {
      decoded.dispose();
    }
    onProgress?.(pageIndex + 1, pages.length);
    // Entrega tempo ao navegador entre páginas para manter a interface responsiva.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }

  return processed;
}

export async function createPageThumbnail(page: ExtractedPage, maxDimension = 480) {
  if (page.type === "image/gif") return page;
  const decoded = await decodeImage(page);
  try {
    const crop = detectContentBounds(decoded.source, {
      x: 0,
      y: 0,
      width: decoded.width,
      height: decoded.height,
    });
    const thumbnail = await renderOptimizedPage(decoded.source, crop, maxDimension, 0.8);
    return {
      name: replaceExtension("cover", thumbnail.type),
      bytes: thumbnail.bytes,
      type: thumbnail.type,
    } satisfies ExtractedPage;
  } finally {
    decoded.dispose();
  }
}

async function decodeImage(page: ExtractedPage): Promise<DecodedImage> {
  const blob = new Blob([page.bytes as unknown as BlobPart], { type: page.type });
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Versões antigas do Safari expõem a API, mas não aceitam opções.
    }
  }

  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => URL.revokeObjectURL(url),
  };
}

function splitSpread(width: number, height: number, mangaOrder: boolean): Crop[] {
  const leftWidth = Math.floor(width / 2);
  const rightWidth = width - leftWidth;
  const left = { x: 0, y: 0, width: leftWidth, height };
  const right = { x: leftWidth, y: 0, width: rightWidth, height };
  return mangaOrder ? [right, left] : [left, right];
}

function detectContentBounds(source: CanvasImageSource, segment: Crop): Crop {
  const scale = Math.min(1, 512 / Math.max(segment.width, segment.height));
  const width = Math.max(1, Math.round(segment.width * scale));
  const height = Math.max(1, Math.round(segment.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return segment;
  context.drawImage(
    source,
    segment.x,
    segment.y,
    segment.width,
    segment.height,
    0,
    0,
    width,
    height,
  );
  const pixels = context.getImageData(0, 0, width, height).data;
  const corners = [
    pixelAt(pixels, width, 0, 0),
    pixelAt(pixels, width, width - 1, 0),
    pixelAt(pixels, width, 0, height - 1),
    pixelAt(pixels, width, width - 1, height - 1),
  ];
  const background = [0, 1, 2].map((channel) =>
    Math.round(corners.reduce((sum, color) => sum + color[channel]!, 0) / corners.length),
  );
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const offset = (y * width + x) * 4;
      const difference =
        Math.abs(pixels[offset]! - background[0]!) +
        Math.abs(pixels[offset + 1]! - background[1]!) +
        Math.abs(pixels[offset + 2]! - background[2]!);
      if (pixels[offset + 3]! > 20 && difference > 54) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY) return segment;
  const padding = 4;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);
  const retainedWidth = (maxX - minX + 1) / width;
  const retainedHeight = (maxY - minY + 1) / height;
  // Evita cortes agressivos quando a detecção encontra somente parte da arte.
  if (retainedWidth < 0.72 || retainedHeight < 0.72) return segment;
  const offsetX = Math.round(minX / scale);
  const offsetY = Math.round(minY / scale);
  return {
    x: segment.x + offsetX,
    y: segment.y + offsetY,
    width: Math.min(segment.width - offsetX, Math.round((maxX - minX + 1) / scale)),
    height: Math.min(segment.height - offsetY, Math.round((maxY - minY + 1) / scale)),
  };
}

function pixelAt(pixels: Uint8ClampedArray, width: number, x: number, y: number) {
  const offset = (y * width + x) * 4;
  return [pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!];
}

async function renderOptimizedPage(
  source: CanvasImageSource,
  crop: Crop,
  maxDimension: number,
  quality = 0.88,
) {
  const scale = Math.min(1, maxDimension / Math.max(crop.width, crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Este navegador não conseguiu preparar a imagem.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  let blob = await canvasToBlob(canvas, "image/webp", quality);
  if (!blob || blob.type !== "image/webp") {
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }
  if (!blob) throw new Error("Não foi possível converter uma das páginas.");
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

function replaceExtension(name: string, type: string) {
  return `${name}.${type === "image/webp" ? "webp" : "jpg"}`;
}
