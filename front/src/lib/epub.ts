import { strFromU8, unzip, type Unzipped } from "fflate";
import DOMPurify from "dompurify";

async function unpackEpub(file: Blob) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return new Promise<Unzipped>((resolve, reject) => {
    unzip(bytes, (error, archive) => error ? reject(error) : resolve(archive));
  });
}

export type EpubSection = {
  title: string;
  html: string;
};

export type EpubPage = EpubSection;

/**
 * Resultado da leitura de um EPUB.
 *
 * - "images": mangá/KCC, onde cada imagem é uma página fixa.
 * - "text": livro, onde a paginação depende do tamanho do leitor
 *   (igual ao Calibre) e por isso NÃO é feita aqui.
 */
export type EpubBook = {
  kind: "images" | "text";
  sections: EpubSection[];

  /**
   * Estimativa usada apenas para exibir a quantidade de páginas
   * no catálogo. A paginação real acontece no leitor.
   */
  estimatedPages: number;
};

const SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true },

  FORBID_TAGS: [
    "style",
    "form",
    "input",
    "button",
    "video",
    "audio",
    "source",
    "script",
    "iframe",
    "object",
    "embed",
  ],

  FORBID_ATTR: [
    "style",
    "srcset",
    "href",
    "id",
    "name",
    "onclick",
    "onload",
    "onerror",
  ],
};

/**
 * Quantidade aproximada de caracteres de uma página impressa.
 * Usada só para a estimativa mostrada fora do leitor.
 */
const CHARACTERS_PER_PAGE = 1600;

/**
 * Algoritmos usados por EPUB para ofuscação de fontes.
 *
 * A existência de META-INF/encryption.xml não significa
 * necessariamente que o livro possui DRM.
 *
 * EPUBs podem utilizar encryption.xml apenas para declarar
 * fontes ofuscadas.
 */
const ALLOWED_FONT_OBFUSCATION_ALGORITHMS = new Set([
  // IDPF EPUB font obfuscation
  "http://www.idpf.org/2008/embedding",

  // Adobe font obfuscation
  "http://ns.adobe.com/pdf/enc#RC",
]);

/**
 * Verifica se o EPUB possui criptografia real.
 *
 * Ofuscação de fontes TTF/OTF/WOFF/WOFF2 é permitida.
 *
 * Qualquer criptografia aplicada ao conteúdo do livro,
 * como XHTML, HTML, imagens etc., continua sendo bloqueada.
 */
function validateEpubEncryption(
  archive: Record<string, Uint8Array>,
) {
  const encryptionBytes = archive["META-INF/encryption.xml"];

  /**
   * A maioria dos EPUBs não possui encryption.xml.
   */
  if (!encryptionBytes) {
    return;
  }

  const encryptionDoc = new DOMParser().parseFromString(
    strFromU8(encryptionBytes),
    "application/xml",
  );

  if (encryptionDoc.querySelector("parsererror")) {
    throw new Error(
      "O ePub possui um arquivo encryption.xml inválido.",
    );
  }

  const encryptedItems = Array.from(
    encryptionDoc.getElementsByTagNameNS(
      "*",
      "EncryptedData",
    ),
  );

  /**
   * encryption.xml existe, mas não declara nenhum recurso
   * criptografado.
   */
  if (!encryptedItems.length) {
    return;
  }

  for (const encryptedItem of encryptedItems) {
    const encryptionMethod =
      encryptedItem.getElementsByTagNameNS(
        "*",
        "EncryptionMethod",
      )[0];

    const cipherReference =
      encryptedItem.getElementsByTagNameNS(
        "*",
        "CipherReference",
      )[0];

    const algorithm =
      encryptionMethod
        ?.getAttribute("Algorithm")
        ?.trim() ?? "";

    const uri =
      cipherReference
        ?.getAttribute("URI")
        ?.trim() ?? "";

    /**
     * Se não conseguimos identificar exatamente o algoritmo
     * ou o recurso afetado, não assumimos que seja seguro.
     */
    if (!algorithm || !uri) {
      throw new Error(
        "Este ePub possui conteúdo criptografado não identificado. " +
          "Envie uma versão sem DRM.",
      );
    }

    let cleanUri = uri;

    try {
      cleanUri = decodeURIComponent(
        uri
          .split("?")[0]!
          .split("#")[0]!,
      );
    } catch {
      cleanUri = uri
        .split("?")[0]!
        .split("#")[0]!;
    }

    cleanUri = cleanUri.toLowerCase();

    /**
     * Extensões comuns de fontes utilizadas dentro de EPUBs.
     */
    const isFont =
      /\.(ttf|otf|woff|woff2)$/i.test(cleanUri);

    const isAllowedFontObfuscation =
      isFont &&
      ALLOWED_FONT_OBFUSCATION_ALGORITHMS.has(
        algorithm,
      );

    /**
     * Ofuscação de fonte não é tratada como DRM do conteúdo.
     */
    if (isAllowedFontObfuscation) {
      continue;
    }

    /**
     * Qualquer outra criptografia é bloqueada.
     *
     * Isso inclui, por exemplo:
     *
     * - XHTML criptografado
     * - HTML criptografado
     * - imagens criptografadas
     * - CSS criptografado
     * - algoritmos desconhecidos
     */
    throw new Error(
      "Este ePub possui conteúdo criptografado. " +
        "Envie uma versão sem DRM.",
    );
  }
}

export async function readEpub(
  file: Blob,
): Promise<EpubBook> {
  const archive = await unpackEpub(file);

  const xml = (path: string) => {
    const bytes = archive[path];

    if (!bytes) {
      throw new Error(
        `ePub inválido: recurso ausente (${path}).`,
      );
    }

    const doc = new DOMParser().parseFromString(
      strFromU8(bytes),
      "application/xml",
    );

    if (doc.querySelector("parsererror")) {
      throw new Error(
        "O ePub contém XML inválido.",
      );
    }

    return doc;
  };

  /**
   * Verifica DRM/criptografia.
   *
   * Diferente da implementação anterior, encryption.xml
   * sozinho não causa mais bloqueio.
   */
  validateEpubEncryption(archive);

  const packagePath = xml(
    "META-INF/container.xml",
  )
    .getElementsByTagNameNS(
      "*",
      "rootfile",
    )[0]
    ?.getAttribute("full-path");

  if (!packagePath) {
    throw new Error(
      "O arquivo não é um ePub válido.",
    );
  }

  const packageDoc = xml(packagePath);

  const items = Array.from(
    packageDoc.getElementsByTagNameNS(
      "*",
      "item",
    ),
  );

  /**
   * Resolve caminhos relativos dentro do EPUB.
   */
  const resolve = (
    base: string,
    href: string,
  ) => {
    try {
      const url = new URL(
        href,
        `https://epub.invalid/${base}`,
      );

      if (
        url.origin !==
        "https://epub.invalid"
      ) {
        return "";
      }

      return decodeURIComponent(
        url.pathname.slice(1),
      );
    } catch {
      return "";
    }
  };

  /**
   * Converte uma imagem do EPUB para Data URL.
   */
  const imageUrls = new Map<string, Promise<string>>();
  const toDataUrl = (
    bytes: Uint8Array,
    path: string,
  ) => {
    const cached = imageUrls.get(path);
    if (cached) return cached;
    const result = new Promise<string>(
      (done, reject) => {
        const extension =
          path
            .split(".")
            .pop()
            ?.toLowerCase() ?? "";

        const type =
          extension === "jpg"
            ? "jpeg"
            : extension;

        const reader =
          new FileReader();

        reader.onload = () =>
          done(
            String(reader.result),
          );

        reader.onerror = () =>
          reject(
            new Error(
              "Não foi possível ler uma imagem do ePub.",
            ),
          );

        reader.readAsDataURL(
          new Blob(
            [bytes as BlobPart],
            {
              type: `image/${type}`,
            },
          ),
        );
      },
    );
    imageUrls.set(path, result);
    return result;
  };

  const imagePages: EpubPage[] = [];
  const textSections: EpubSection[] = [];

  let characters = 0;

  /**
   * Percorre o spine do EPUB na ordem de leitura.
   */
  for (
    const ref of Array.from(
      packageDoc.getElementsByTagNameNS(
        "*",
        "itemref",
      ),
    )
  ) {
    /**
     * Conteúdo marcado como não-linear não pertence
     * à sequência principal de leitura.
     */
    if (
      ref.getAttribute("linear") ===
      "no"
    ) {
      continue;
    }

    const item = items.find(
      (candidate) =>
        candidate.id ===
        ref.getAttribute("idref"),
    );

    if (!item) {
      continue;
    }

    const path = resolve(
      packagePath,
      item.getAttribute("href") ??
        "",
    );

    if (!path) {
      continue;
    }

    const bytes = archive[path];

    if (!bytes) {
      throw new Error(`O ePub está incompleto: seção ausente (${path}).`);
    }

    const doc =
      new DOMParser().parseFromString(
        strFromU8(bytes),
        "text/html",
      );

    const images = Array.from(
      doc.querySelectorAll("img"),
    );

    const text = (
      doc.body?.textContent ?? ""
    ).trim();

    /**
     * -----------------------------------------------------
     * MANGÁ / EPUB FIXO
     * -----------------------------------------------------
     *
     * Se o documento possui imagens e praticamente nenhum
     * texto, tratamos cada imagem como uma página.
     */
    if (
      images.length > 0 &&
      text.length < 200
    ) {
      for (const img of images) {
        const imagePath = resolve(
          path,
          img.getAttribute("src") ??
            "",
        );

        if (!imagePath) {
          continue;
        }

        const imageBytes =
          archive[imagePath];

        if (
          !imageBytes ||
          !/\.(png|jpe?g|gif|webp)$/i.test(
            imagePath,
          )
        ) {
          continue;
        }

        const src =
          await toDataUrl(
            imageBytes,
            imagePath,
          );

        const pageNumber =
          imagePages.length + 1;

        imagePages.push({
          title: `Página ${pageNumber}`,

          html: DOMPurify.sanitize(
            `<div class="epub-manga-page"><img src="${src}" alt="Página ${pageNumber}" /></div>`,
            SANITIZE_OPTIONS,
          ),
        });
      }

      continue;
    }

    /**
     * -----------------------------------------------------
     * LIVRO
     * -----------------------------------------------------
     *
     * Mantemos o capítulo inteiro.
     *
     * A divisão em páginas acontece posteriormente no
     * leitor, de acordo com o tamanho da tela.
     */
    if (
      !text &&
      images.length === 0
    ) {
      continue;
    }

    /**
     * Converte imagens embutidas no capítulo para Data URL.
     *
     * Isso permite que continuem funcionando quando o HTML
     * for exibido isoladamente pelo leitor.
     */
    for (const img of images) {
      const imagePath = resolve(
        path,
        img.getAttribute("src") ??
          "",
      );

      const imageBytes =
        imagePath
          ? archive[imagePath]
          : undefined;

      if (
        !imageBytes ||
        !/\.(png|jpe?g|gif|webp)$/i.test(
          imagePath,
        )
      ) {
        img.remove();
        continue;
      }

      img.setAttribute(
        "src",
        await toDataUrl(
          imageBytes,
          imagePath,
        ),
      );
    }

    const title =
      doc
        .querySelector(
          "h1,h2,h3,title",
        )
        ?.textContent
        ?.trim() ||
      `Capítulo ${
        textSections.length + 1
      }`;

    const html =
      DOMPurify.sanitize(
        doc.body?.innerHTML ?? "",
        SANITIZE_OPTIONS,
      );

    if (!html.trim()) {
      continue;
    }

    characters += text.length;

    textSections.push({
      title,
      html,
    });
  }

  /**
   * EPUB composto exclusivamente por imagens.
   */
  if (
    imagePages.length > 0 &&
    textSections.length === 0
  ) {
    return {
      kind: "images",

      sections: imagePages,

      estimatedPages:
        imagePages.length,
    };
  }

  /**
   * Nenhum conteúdo encontrado.
   */
  if (
    !textSections.length &&
    !imagePages.length
  ) {
    throw new Error(
      "O ePub não contém páginas para leitura.",
    );
  }

  /**
   * Livro de texto.
   */
  return {
    kind: "text",

    sections:
      textSections.length
        ? textSections
        : imagePages,

    estimatedPages: Math.max(
      1,

      Math.round(
        characters /
          CHARACTERS_PER_PAGE,
      ) || imagePages.length,
    ),
  };
}

/**
 * Extrai automaticamente a capa do EPUB.
 *
 * Suporta:
 *
 * - EPUB 3: properties="cover-image"
 * - EPUB 2: <meta name="cover" ...>
 * - fallback por ID/nome contendo "cover"
 */
export async function extractEpubCover(
  file: Blob,
): Promise<File | null> {
  const archive = await unpackEpub(file);

  const parseXml = (
    path: string,
  ) => {
    const bytes = archive[path];

    if (!bytes) {
      throw new Error(
        `ePub inválido: recurso ausente (${path}).`,
      );
    }

    const doc =
      new DOMParser().parseFromString(
        strFromU8(bytes),
        "application/xml",
      );

    if (
      doc.querySelector(
        "parsererror",
      )
    ) {
      throw new Error(
        "O ePub contém XML inválido.",
      );
    }

    return doc;
  };

  const containerDoc =
    parseXml(
      "META-INF/container.xml",
    );

  const packagePath =
    containerDoc
      .getElementsByTagNameNS(
        "*",
        "rootfile",
      )[0]
      ?.getAttribute(
        "full-path",
      );

  if (!packagePath) {
    throw new Error(
      "O arquivo não é um ePub válido.",
    );
  }

  const packageDoc =
    parseXml(packagePath);

  const packageDirectory =
    packagePath.includes("/")
      ? packagePath.slice(
          0,
          packagePath.lastIndexOf(
            "/",
          ) + 1,
        )
      : "";

  /**
   * Resolve caminhos relativos dentro do package OPF.
   */
  const resolvePath = (
    href: string,
  ) => {
    const normalized: string[] =
      [];

    const cleanHref =
      href
        .split("#")[0]!
        .split("?")[0]!;

    for (
      const part of `${packageDirectory}${cleanHref}`.split(
        "/",
      )
    ) {
      if (
        !part ||
        part === "."
      ) {
        continue;
      }

      if (part === "..") {
        normalized.pop();
      } else {
        normalized.push(part);
      }
    }

    try {
      return decodeURIComponent(
        normalized.join("/"),
      );
    } catch {
      return normalized.join("/");
    }
  };

  const manifestItems =
    Array.from(
      packageDoc.getElementsByTagNameNS(
        "*",
        "item",
      ),
    );

  /**
   * -----------------------------------------------------
   * EPUB 3
   * -----------------------------------------------------
   *
   * <item properties="cover-image" ... />
   */
  let coverItem =
    manifestItems.find(
      (item) =>
        (
          item.getAttribute(
            "properties",
          ) ?? ""
        )
          .split(/\s+/)
          .includes(
            "cover-image",
          ),
    );

  /**
   * -----------------------------------------------------
   * EPUB 2
   * -----------------------------------------------------
   *
   * <meta
   *   name="cover"
   *   content="cover-image-id"
   * />
   */
  if (!coverItem) {
    const metas = Array.from(
      packageDoc.getElementsByTagNameNS(
        "*",
        "meta",
      ),
    );

    const coverId =
      metas
        .find(
          (meta) =>
            meta
              .getAttribute("name")
              ?.toLowerCase() ===
            "cover",
        )
        ?.getAttribute(
          "content",
        );

    if (coverId) {
      coverItem =
        manifestItems.find(
          (item) =>
            item.getAttribute(
              "id",
            ) === coverId,
        );
    }
  }

  /**
   * -----------------------------------------------------
   * FALLBACK
   * -----------------------------------------------------
   *
   * Alguns EPUBs antigos ou malformados não declaram a
   * capa corretamente.
   *
   * Procuramos então uma imagem cujo ID ou caminho
   * contenha "cover".
   */
  if (!coverItem) {
    coverItem =
      manifestItems.find(
        (item) => {
          const id =
            item
              .getAttribute("id")
              ?.toLowerCase() ??
            "";

          const href =
            item
              .getAttribute(
                "href",
              )
              ?.toLowerCase() ??
            "";

          const mediaType =
            item.getAttribute(
              "media-type",
            ) ?? "";

          return (
            mediaType.startsWith(
              "image/",
            ) &&
            (id.includes(
              "cover",
            ) ||
              href.includes(
                "cover",
              ))
          );
        },
      );
  }

  const href =
    coverItem?.getAttribute(
      "href",
    );

  /**
   * Nenhuma capa encontrada.
   */
  if (
    !coverItem ||
    !href
  ) {
    return null;
  }

  const coverPath =
    resolvePath(href);

  const bytes =
    archive[coverPath];

  if (!bytes) {
    return null;
  }

  const mediaType =
    coverItem.getAttribute(
      "media-type",
    ) ||
    "image/jpeg";

  let extension = "jpg";

  switch (
    mediaType.toLowerCase()
  ) {
    case "image/png":
      extension = "png";
      break;

    case "image/webp":
      extension = "webp";
      break;

    case "image/gif":
      extension = "gif";
      break;

    case "image/svg+xml":
      extension = "svg";
      break;

    case "image/jpeg":
    case "image/jpg":
    default:
      extension = "jpg";
      break;
  }

  return new File(
    [bytes as BlobPart],

    `epub-cover.${extension}`,

    {
      type: mediaType,
    },
  );
}
