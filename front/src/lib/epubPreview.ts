import type { EpubBook } from "@/lib/epub";

type TextBlock = { text: string; heading: boolean };
type PreviewLine = { text: string; x: number; y: number; heading: boolean };

// Keep paragraph boundaries and inline text (emphasis, links, etc.) without
// mounting publication HTML or inheriting its styles into the application.
function textBlocks(html: string): TextBlock[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, nav, [hidden]").forEach((node) => node.remove());
  const blocks: TextBlock[] = [];
  let buffer = "";
  const flush = (heading: boolean) => {
    const text = buffer.replace(/\s+/g, " ").trim();
    if (text) blocks.push({ text, heading });
    buffer = "";
  };
  const walk = (node: Node, heading = false) => {
    if (node.nodeType === Node.TEXT_NODE) {
      buffer += node.textContent ?? "";
      return;
    }
    if (!(node instanceof Element)) return;
    const isBlock = /^(P|DIV|SECTION|ARTICLE|H[1-6]|BLOCKQUOTE|LI|UL|OL|TR|PRE|BR|HR)$/.test(
      node.tagName,
    );
    const isHeading = /^H[1-6]$/.test(node.tagName) || heading;
    if (isBlock) flush(heading);
    node.childNodes.forEach((child) => walk(child, isHeading));
    if (isBlock) flush(isHeading);
  };
  walk(doc.body);
  flush(false);
  return blocks;
}

/**
 * EPUB text has no intrinsic page 10. Lay it out at a stable 420 × 560 size,
 * independent of viewport/reader preferences, and rasterize preview page 10.
 * Only source content is used. Image-only EPUBs retain their actual tenth image.
 */
export function renderEpubPageTen(
  book: EpubBook,
  title: string,
): { imageUrl: string; text: string } | null {
  if (book.kind === "images") {
    const section = book.sections[9];
    if (!section) return null;
    const doc = new DOMParser().parseFromString(section.html, "text/html");
    const imageUrl = doc.querySelector("img")?.getAttribute("src");
    return imageUrl ? { imageUrl, text: "" } : null;
  }

  const canvas = document.createElement("canvas");
  // Render at 3× for crisp type when mapped onto the curved sheet.
  canvas.width = 1260;
  canvas.height = 1680;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a prévia do EPUB.");
  context.scale(3, 3);
  const font = (heading: boolean) => `${heading ? "bold 17" : "13"}px Georgia, serif`;
  const left = 42;
  const right = 378;
  const top = 72;
  const bottom = 494;
  const lineHeight = 18;
  const lines: PreviewLine[] = [];
  let page = 1;
  let y = top;
  const nextPage = () => {
    page += 1;
    y = top;
  };
  const addLine = (text: string, heading: boolean, indent: number) => {
    if (y > bottom) nextPage();
    if (page === 10) lines.push({ text, heading, x: left + indent, y });
    y += lineHeight;
  };

  sections: for (const section of book.sections) {
    const blocks = textBlocks(section.html);
    if (!blocks.length) continue;
    // A spine section starts on a fresh preview page, like a printed chapter.
    if (y > top) nextPage();
    for (const block of blocks) {
      if (page > 10) break sections;
      context.font = font(block.heading);
      if (block.heading && y + lineHeight * 3 > bottom) nextPage();
      let line = "";
      let indent = block.heading ? 0 : 16;
      for (const word of block.text.split(" ")) {
        const candidate = line ? `${line} ${word}` : word;
        if (context.measureText(candidate).width <= right - left - indent) {
          line = candidate;
          continue;
        }
        if (line) {
          addLine(line, block.heading, indent);
          indent = 0;
          line = "";
        }
        // Very long words/URLs must not spill beyond the paper margin.
        for (const character of word) {
          if (context.measureText(line + character).width > right - left - indent) {
            addLine(line, block.heading, indent);
            indent = 0;
            line = "";
          }
          line += character;
        }
        if (page > 10) break sections;
      }
      if (line) addLine(line, block.heading, indent);
      y += block.heading ? 12 : 7;
    }
  }
  if (!lines.length) return null;

  context.fillStyle = "#f1e8d6";
  context.fillRect(0, 0, 420, 560);
  context.fillStyle = "#675d4d";
  context.textAlign = "center";
  context.font = "11px Georgia, serif";
  context.fillText(title, 210, 35, right - left);
  context.fillText("10", 210, 533);
  context.textAlign = "left";
  context.fillStyle = "#352e25";
  for (const line of lines) {
    context.font = font(line.heading);
    context.fillText(line.text, line.x, line.y);
  }
  return {
    imageUrl: canvas.toDataURL("image/png"),
    text: lines.map((line) => line.text).join("\n"),
  };
}

/** Store exactly one raster image for the public sample, not the EPUB itself. */
export async function epubPreviewToPng(imageUrl: string): Promise<Blob> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("Não foi possível converter a página de amostra.");
  const original = await response.blob();
  if (original.type === "image/png") return original;
  const bitmap = await createImageBitmap(original);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1260;
    canvas.height = 1680;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Prévia de imagem indisponível neste dispositivo.");
    context.fillStyle = "#f1e8d6";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((png) => png ? resolve(png) : reject(new Error("A imagem da prévia não pôde ser convertida.")), "image/png");
    });
  } finally {
    bitmap.close();
  }
}
