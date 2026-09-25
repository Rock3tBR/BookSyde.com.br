import {
  unitLabel,
  resolveVolumeNumbers,
  validatePublicationFiles,
  validateVolumeCovers,
  type WorkType,
  type UnitKind,
} from "@/lib/publication";
import { extractEpubCover, readEpub } from "@/lib/epub";
import { supabase } from "@/integrations/supabase/client";
import {
  extractPages,
  padIndex,
  usesBinaryImageOrder,
} from "@/lib/mangaFile";
import {
  createPageThumbnail,
  processMangaPages,
  type MangaProcessingOptions,
} from "@/lib/imageProcessing";
import { STORAGE_PREFIX } from "@/lib/media";
import { mapWithConcurrency, chunk, extensionForType } from "@/lib/uploadBatchUtils";
import { uploadPrivateFileToR2, deletePrivateR2Files } from "@/lib/r2Client";

import { updateStatus, type VolumeUploadStatus } from "@/lib/volumeUploadStatus";
export { getVolumeUploadStatus, subscribeToVolumeUpload } from "@/lib/volumeUploadStatus";


type UploadInput = {
  mangaId: string;
  workType: WorkType;
  unitKind: UnitKind;
  firstNumber: number;
  numbers?: number[];
  files: File[];
  covers: Array<File | null>;
  processing: MangaProcessingOptions;
  retainSource: boolean;
};

type UploadJob = {
  id: string;
  input: UploadInput;
  state: "queued" | "running" | "completed" | "error";
  progress: number;
  currentVolume: number | null;
  message: string;
  totalPages: number;
};

const MAX_CONCURRENT_UPLOADS = 2;
const jobs: UploadJob[] = [];



export function dismissVolumeUpload() {
  if (
    jobs.some(
      (job) =>
        job.state === "queued" ||
        job.state === "running",
    )
  ) {
    return;
  }

  jobs.splice(0, jobs.length);

  updateStatus({
    state: "idle",
    progress: 0,
    currentVolume: null,
    totalVolumes: 0,
    message: "",
  });
}

export function startVolumeUpload(input: UploadInput) {
  if (
    !input.mangaId ||
    !input.files.length
  ) {
    throw new Error(
      "Selecione a obra e os arquivos.",
    );
  }

  // Explicit numbers may have gaps (e.g. chapters 3, 4, 5, 10).
  validatePublicationFiles(input.workType, input.files, input.numbers ? 0 : input.firstNumber);
  validateVolumeCovers(input.covers);

  const requestedNumbers = resolveVolumeNumbers(input.files, input.firstNumber, input.numbers);
  // Snapshot the queue input so edits in the review screen cannot affect a running job.
  input = { ...input, files: [...input.files], covers: [...input.covers], processing: { ...input.processing }, numbers: requestedNumbers };

  const reservedNumbers = jobs
    .filter(
      (job) =>
        job.input.mangaId ===
          input.mangaId &&
        (
          job.state === "queued" ||
          job.state === "running"
        ),
    )
    .flatMap((job) => resolveVolumeNumbers(job.input.files, job.input.firstNumber, job.input.numbers));

  const duplicated =
    requestedNumbers.filter(
      (number) =>
        reservedNumbers.includes(number),
    );

  if (duplicated.length) {
    throw new Error(
      `Os números ${duplicated.join(
        ", ",
      )} já estão em outro lote da fila.`,
    );
  }

  jobs.push({
    id: `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`,
    input,
    state: "queued",
    progress: 0,
    currentVolume:
      input.firstNumber,
    message:
      "Aguardando processamento…",
    totalPages: 0,
  });

  refreshAggregateStatus();
  queueMicrotask(processQueue);
}

function processQueue() {
  let available =
    MAX_CONCURRENT_UPLOADS -
    jobs.filter(
      (job) =>
        job.state === "running",
    ).length;

  const queued = jobs
    .filter(
      (job) =>
        job.state === "queued",
    )
    .slice(0, available);

  for (const job of queued) {
    available -= 1;

    job.state = "running";
    job.message =
      "Preparando volumes…";

    refreshAggregateStatus();

    void runUpload(job).finally(() => {
      refreshAggregateStatus();
      processQueue();
    });

    if (!available) break;
  }
}

async function runUpload(
  job: UploadJob,
) {
  const {
    mangaId,
    firstNumber,
    files,
    covers,
    processing,
    retainSource,
    unitKind,
  } = job.input;

  let stage = "Validando permissões da obra";
  let completedVolumes = 0;

  let pendingVolumeId:
    | string
    | null = null;

  const pendingPaths: {
    bucket: string;
    path: string;
  }[] = [];

  try {
    stage = "Consultando obra";
    const {
      data: work,
      error: workError,
    } = await supabase
      .from("mangas")
      .select("work_type,is_collection,cover_url")
      .eq("id", mangaId)
      .single();

    if (workError) {
      throw workError;
    }

    if (!["manga", "hq", "gibi", "book"].includes(work.work_type)) {
      throw new Error("Tipo da obra não reconhecido. Corrija o cadastro antes de enviar arquivos.");
    }
    const supportedWorkType = work.work_type as WorkType;
    if (supportedWorkType === "book" && !work.is_collection) {
      if (files.length !== 1 || resolveVolumeNumbers(files, firstNumber, job.input.numbers)[0] !== 1) {
        throw new Error("Um livro individual aceita somente um arquivo no número 1.");
      }
      const { data: existing, error: existingError } = await supabase
        .from("volumes").select("id").eq("manga_id", mangaId).limit(1);
      if (existingError) throw existingError;
      if (existing?.length) throw new Error("Este livro já possui um arquivo. Remova o anterior antes de substituir.");
    }

    validatePublicationFiles(
      supportedWorkType,
      files,
      job.input.numbers ? 0 : firstNumber,
    );

    const volumeNumbers = resolveVolumeNumbers(files, firstNumber, job.input.numbers);

    stage = "Verificando volumes já cadastrados";
    const {
      data: conflicts,
      error: conflictError,
    } = await supabase
      .from("volumes")
      .select("number")
      .eq("manga_id", mangaId)
      .in(
        "number",
        volumeNumbers,
      );

    if (conflictError) {
      throw conflictError;
    }

    if (conflicts?.length) {
      throw new Error(
        `Já existem volumes ou capítulos desta obra com os números: ${conflicts
          .map(
            (item) => item.number,
          )
          .join(", ")}.`,
      );
    }

    let totalPages = 0;

    for (
      let fileIndex = 0;
      fileIndex < files.length;
      fileIndex += 1
    ) {
      const file =
        files[fileIndex]!;

      stage = `Preparando arquivo ${file.name}`;

      const currentNumber = volumeNumbers[fileIndex]!;

      updateJob(job, {
        currentVolume:
          currentNumber,
        message: `Processando ${unitLabel(
          unitKind,
        )}: ${currentNumber}`,
      });

      /*
       * ============================================================
       * EPUB / LIVRO
       * ============================================================
       *
       * IMPORTANTE:
       *
       * O readEpub deve retornar uma entrada por página real.
       *
       * Em EPUB de mangá/KCC, uma página normalmente corresponde
       * a uma imagem.
       *
       * Portanto:
       *
       * page_count = quantidade real de páginas
       *
       * e não:
       *
       * page_count = quantidade de arquivos XHTML.
       */
      if (work.work_type === "book" && /\.epub$/i.test(file.name)) {
        stage = `Lendo EPUB ${file.name}`;
        const book =
          await readEpub(file);

        if (!book.sections.length) {
          throw new Error(
            `${file.name} não contém páginas válidas.`,
          );
        }

        /*
         * A quantidade gravada no banco agora representa
         * exatamente a quantidade retornada pelo parser.
         *
         * O parser deve transformar cada imagem do EPUB
         * em uma página individual.
         */
        const pageCount =
          book.estimatedPages;

        updateJob(job, {
          message: `Processando ${unitLabel(
            unitKind,
          )}: ${currentNumber} · ${pageCount} páginas`,
        });

        stage = `Criando volume ${currentNumber} no banco`;
        const {
          data: volume,
          error,
        } = await supabase
          .from("volumes")
          .insert({
            manga_id: mangaId,
            number: currentNumber,
            unit_kind: unitKind,
            file_format: "epub",

            /*
             * CONTAGEM CORRETA
             */
            page_count:
              pageCount,

            published: false,
          })
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        pendingVolumeId =
          volume.id;

        /*
         * Guarda o EPUB original.
         */
        const sourcePath =
          `${mangaId}/${volume.id}/book.epub`;

        stage = `Enviando EPUB original do volume ${currentNumber} para volume-sources`;
        await uploadPrivateFileToR2(
          mangaId, volume.id, "source", sourcePath, file, "application/epub+zip",
        );

        pendingPaths.push({
          bucket:
            "volume-sources",
          path: sourcePath,
        });

        /*
         * Capa personalizada.
         */
        // Uma obra pode usar sua capa principal quando o EPUB não possui capa.
        // Não bloqueie um EPUB válido apenas pela ausência de imagem de capa.
        let cover = covers[fileIndex] ?? null;
        if (!cover) {
          try {
            cover = await extractEpubCover(file);
          } catch (coverError) {
            console.warn("O EPUB não possui uma capa extraível; usando a capa da obra.", coverError);
          }
        }
        let coverUrl: string | null = work.cover_url ?? null;

        if (cover) {
          stage = `Enviando capa do volume ${currentNumber} para manga-covers`;
          const path =
            `${mangaId}/${volume.id}-${crypto.randomUUID()}`;

          const result =
            await supabase.storage
              .from(
                "manga-covers",
              )
              .upload(
                path,
                cover,
                {
                  contentType:
                    cover.type,
                },
              );

          if (result.error) {
            throw result.error;
          }

          pendingPaths.push({
            bucket:
              "manga-covers",
            path,
          });

          coverUrl =
            `${STORAGE_PREFIX}${path}`;
        }

        // Public storefront sample for NEW EPUBs. Publish only the
        // rasterized tenth page in the private covers bucket: visitors never
        // receive the original EPUB or any additional pages.
        {
          try {
            const { renderEpubPageTen, epubPreviewToPng } = await import("@/lib/epubPreview");
            const preview = renderEpubPageTen(book, file.name.replace(/\.epub$/i, ""));
            if (preview?.imageUrl) {
              const png = await epubPreviewToPng(preview.imageUrl);
              if (png.size) {
                const previewPath = `${mangaId}/${volume.id}-preview-page-10.png`;
                const result = await supabase.storage.from("manga-covers")
                  .upload(previewPath, png, { contentType: "image/png", upsert: true });
                if (result.error) throw result.error;
                pendingPaths.push({ bucket: "manga-covers", path: previewPath });
              }
            }
          } catch (previewError) {
            // A missing sample must not interrupt a successful publication.
            console.warn("Não foi possível criar a amostra do EPUB:", previewError);
          }
        }

        /*
         * Atualiza os metadados do EPUB.
         */
        stage = `Atualizando metadados do volume ${currentNumber}`;
        const updated =
          await supabase
            .from("volumes")
            .update({
              source_path:
                sourcePath,
              source_name:
                file.name,
              source_type:
                "application/epub+zip",
              source_size:
                file.size,
              cover_url:
                coverUrl,
              published: true,
            })
            .eq("id", volume.id)
            .select("id")
            .single();

        if (updated.error) {
          throw updated.error;
        }

        /*
         * Usa a capa do volume 1 como capa da obra,
         * caso a obra ainda não possua uma.
         */
        if (
          coverUrl &&
          currentNumber === 1
        ) {
          stage = `Atualizando capa da obra após volume ${currentNumber}`;
          const {
            error:
              mangaCoverError,
          } = await supabase
            .from("mangas")
            .update({
              cover_url:
                coverUrl,
            })
            .eq(
              "id",
              mangaId,
            )
            .is(
              "cover_url",
              null,
            );

          if (mangaCoverError) {
            throw mangaCoverError;
          }
        }

        pendingVolumeId =
          null;

        pendingPaths.length =
          0;

        totalPages += pageCount;
        completedVolumes += 1;

        updateJob(job, {
          progress: Math.round(
            ((fileIndex + 1) /
              files.length) *
              100,
          ),
        });

        continue;
      }

      /*
       * ============================================================
       * PDF / CBR / CBZ / ZIP / MOBI / AZW / PRC
       * (também usado por livros que não sejam EPUB)
       * ============================================================
       */

      stage = `Extraindo páginas de ${file.name}`;
      const extractedPages =
        await extractPages(
          file,
        );

      if (
        usesBinaryImageOrder(
          file,
        )
      ) {
        extractedPages.reverse();
      }

      updateJob(job, {
        message:
          processing.mode ===
          "original"
            ? `Preparando ${unitLabel(
                unitKind,
              )}: ${currentNumber}`
            : `Otimizando ${unitLabel(
                unitKind,
              )}: ${currentNumber}`,
      });

      stage = `Processando imagens de ${file.name}`;
      const pages =
        await processMangaPages(
          extractedPages,
          processing,
          (
            completed,
            total,
          ) => {
            const volumeShare =
              fileIndex +
              (completed /
                total) *
                0.35;

            updateJob(job, {
              progress:
                Math.round(
                  (volumeShare /
                    files.length) *
                    100,
                ),

              message: `Otimizando ${unitLabel(
                unitKind,
              )}: ${currentNumber} · ${completed}/${total}`,
            });
          },
        );

      if (!pages.length) {
        throw new Error(
          `${file.name} não contém páginas válidas.`,
        );
      }

      /*
       * ============================================================
       * CAPA
       * ============================================================
       */

      let coverUrl:
        | string
        | null = null;

      const selectedCover =
        covers[fileIndex] ?? null;

      const isBookPdf =
        work.work_type === "book" &&
        /\.pdf$/i.test(file.name);

      if (isBookPdf && !selectedCover) {
        throw new Error(
          `Selecione uma capa para o PDF ${file.name}.`,
        );
      }

      const firstPage =
        pages[0]!;

      const generatedCover =
        selectedCover
          ? null
          : await createPageThumbnail(
              firstPage,
            );

      const coverSource =
        selectedCover ??
        new Blob(
          [
            generatedCover!
              .bytes as unknown as BlobPart,
          ],
          {
            type:
              generatedCover!.type,
          },
        );

      const coverName =
        selectedCover?.name ??
        `first-page.${extensionForType(
          generatedCover!.type,
        )}`;

      if (coverSource) {
        stage = `Enviando capa do volume ${currentNumber} para manga-covers`;
        const path =
          `${mangaId}/volume-${currentNumber}-${Date.now()}-${coverName}`;

        const {
          error,
        } = await supabase.storage
          .from(
            "manga-covers",
          )
          .upload(
            path,
            coverSource,
            {
              contentType:
                coverSource.type,
              upsert: true,
            },
          );

        if (error) {
          throw error;
        }

        pendingPaths.push({
          bucket:
            "manga-covers",
          path,
        });

        coverUrl =
          `${STORAGE_PREFIX}${path}`;
      }

      /*
       * ============================================================
       * CRIA VOLUME
       * ============================================================
       */

      stage = `Criando volume ${currentNumber} no banco`;
      const {
        data: volume,
        error: volumeError,
      } = await supabase
        .from("volumes")
        .insert({
          manga_id: mangaId,
          number: currentNumber,
          unit_kind: unitKind,
          published: false,
          title: "",

          /*
           * Para arquivos de imagem/CBZ/etc.,
           * a quantidade de páginas já vem de pages.length.
           */
          page_count:
            pages.length,
        })
        .select("id")
        .single();

      if (volumeError) {
        throw volumeError;
      }

      pendingVolumeId =
        volume.id;

      /*
       * ============================================================
       * ARQUIVO ORIGINAL
       * ============================================================
       */

      if (retainSource) {
        updateJob(job, {
          message: `Guardando arquivo original do ${unitLabel(
            unitKind,
          )}: ${currentNumber}`,
        });

        const safeName =
          file.name.replace(
            /[^a-zA-Z0-9._-]+/g,
            "-",
          );

        const sourcePath =
          `${mangaId}/${volume.id}/${safeName}`;

        stage = `Enviando arquivo original do volume ${currentNumber} para volume-sources`;
        await uploadPrivateFileToR2(
          mangaId, volume.id, "source", sourcePath, file,
          file.type || "application/octet-stream",
        );

        pendingPaths.push({
          bucket:
            "volume-sources",
          path: sourcePath,
        });

        stage = `Salvando metadados do arquivo original do volume ${currentNumber}`;
        const {
          error:
            sourceMetadataError,
        } = await supabase
          .from("volumes")
          .update({
            source_path:
              sourcePath,
            source_name:
              file.name,
            source_type:
              file.type ||
              "application/octet-stream",
            source_size:
              file.size,
          })
          .eq("id", volume.id)
          .select("id")
          .single();

        if (sourceMetadataError) {
          throw sourceMetadataError;
        }
      }

      /*
       * ============================================================
       * ATUALIZA CAPA
       * ============================================================
       */

      if (coverUrl) {
        stage = `Vinculando capa ao volume ${currentNumber}`;
        const result =
          await supabase
            .from("volumes")
            .update({
              cover_url:
                coverUrl,
            })
            .eq(
              "id",
              volume.id,
            );

        if (result.error) throw result.error;
      }

      /*
       * ============================================================
       * ENVIA PÁGINAS
       * ============================================================
       */

      let uploadedPages = 0;
      stage = `Enviando páginas do volume ${currentNumber} para manga-pages`;

      const rows =
        await mapWithConcurrency(
          pages,
          6,
          async (
            page,
            pageIndex,
          ) => {
            const extension =
              extensionForType(
                page.type,
              );

            const path =
              `${mangaId}/${volume.id}/${padIndex(
                pageIndex,
              )}.${extension}`;

            await uploadPrivateFileToR2(
              mangaId, volume.id, "page", path,
              new Blob([page.bytes as unknown as BlobPart], { type: page.type }),
              page.type,
            );

            pendingPaths.push({
              bucket:
                "manga-pages",
              path,
            });

            uploadedPages +=
              1;

            const completedShare =
              fileIndex +
              0.35 +
              (uploadedPages /
                pages.length) *
                0.65;

            updateJob(job, {
              progress:
                Math.round(
                  (completedShare /
                    files.length) *
                    100,
                ),

              message: `Enviando ${unitLabel(
                unitKind,
              )}: ${currentNumber}`,
            });

            return {
              volume_id:
                volume.id,
              page_index:
                pageIndex,
              storage_path:
                path,
            };
          },
        );

      /*
       * Insere as páginas no banco em lotes.
       */
      stage = `Gravando páginas do volume ${currentNumber} no banco`;
      for (const batch of chunk(
        rows,
        250,
      )) {
        const {
          error,
        } = await supabase
          .from("pages")
          .insert(batch);

        if (error) {
          throw error;
        }
      }

      /*
       * Publica o volume somente depois de todas
       * as páginas terem sido enviadas.
       */
      stage = `Publicando volume ${currentNumber}`;
      const publication =
        await supabase
          .from("volumes")
          .update({
            published: true,
          })
          .eq("id", volume.id)
          .select("id")
          .single();

      if (publication.error) {
        throw publication.error;
      }

      /*
       * Atualiza capa da obra.
       */
      if (
        coverUrl &&
        currentNumber === 1
      ) {
        stage = `Atualizando capa da obra após volume ${currentNumber}`;
        const { error: mangaCoverError } = await supabase
          .from("mangas")
          .update({
            cover_url:
              coverUrl,
          })
          .eq(
            "id",
            mangaId,
          )
          .is(
            "cover_url",
            null,
          );
        if (mangaCoverError) throw mangaCoverError;
      }

      pendingVolumeId =
        null;

      pendingPaths.length =
        0;

      totalPages += pages.length;
      completedVolumes += 1;
    }

    /*
     * ============================================================
     * CONCLUÍDO
     * ============================================================
     */

    updateJob(job, {
      state: "completed",
      progress: 100,
      currentVolume: null,
      totalPages,
      message: `${files.length} publicação(ões) e ${totalPages} páginas publicados`,
    });
  } catch (error) {
    /*
     * O Storage valida se o caminho pertence a um volume existente.
     * Limpar arquivos PRIMEIRO, enquanto a referência de propriedade existe;
     * apagar páginas e volume DEPOIS. Caso contrário, o próprio rollback
     * recebe erro de RLS e deixa arquivos órfãos.
     */
    const cleanupErrors: string[] = [];
    try { await deletePrivateR2Files(pendingPaths); }
    catch (cleanupError) { cleanupErrors.push(`Supabase Storage: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`); }
    for (const bucket of [
      "manga-covers",
    ]) {
      const paths = pendingPaths
        .filter((entry) => entry.bucket === bucket)
        .map((entry) => entry.path);

      for (const batch of chunk(paths, 100)) {
        const result = await supabase.storage.from(bucket).remove(batch);
        if (result.error) cleanupErrors.push(`${bucket}: ${result.error.message}`);
      }
    }

    if (pendingVolumeId) {
      const pagesCleanup = await supabase
        .from("pages")
        .delete()
        .eq("volume_id", pendingVolumeId);
      if (pagesCleanup.error) cleanupErrors.push(`páginas: ${pagesCleanup.error.message}`);

      // Preserva o volume quando o Storage ou as páginas não puderem ser
      // limpos: sem ele, a política de Storage não reconhece mais os arquivos.
      if (!cleanupErrors.length) {
        const volumeCleanup = await supabase
          .from("volumes")
          .delete()
          .eq("id", pendingVolumeId);
        if (volumeCleanup.error) cleanupErrors.push(`volume: ${volumeCleanup.error.message}`);
      }
    }

    const originalMessage = (() => {
      if (error instanceof Error && error.message) return error.message;
      if (typeof error === "string") return error;
      if (error && typeof error === "object") {
        const value = error as Record<string, unknown>;
        for (const key of ["message", "code", "details", "hint", "error"]) {
          const item = value[key];
          if (typeof item === "string" && item.trim()) return item;
          if (item instanceof Error && item.message) return item.message;
          if (item && typeof item === "object") {
            try {
              const nested = JSON.stringify(item);
              if (nested && nested !== "{}") return nested;
            } catch { /* ignore */ }
          }
        }
        try {
          const serialized = JSON.stringify(error);
          if (serialized && serialized !== "{}") return serialized;
        } catch { /* ignore */ }
      }
      return "Erro desconhecido no envio.";
    })();
    const diagnostic = `${stage}: ${originalMessage}`;
    // Se o rollback falhar, é importante informar o criador para não
    // ocultar um volume parcialmente cadastrado e causar duplicação no retry.
    const completedBeforeFailure = completedVolumes > 0
      ? " Os arquivos publicados anteriormente no lote foram preservados; verifique a lista antes de tentar novamente."
      : "";
    const message = cleanupErrors.length
      ? `${diagnostic}. Limpeza parcial falhou (${cleanupErrors.join("; ")}); confira o volume antes de reenviar.${completedBeforeFailure}`
      : `${diagnostic}.${completedBeforeFailure}`;
    console.error("[BookSyde] Falha no envio de publicação", {
      stage,
      mangaId,
      volumeId: pendingVolumeId,
      error,
      cleanupErrors,
    });

    updateJob(job, {
      state: "error",
      message,
    });
  }
}

function updateJob(
  job: UploadJob,
  next: Partial<UploadJob>,
) {
  Object.assign(
    job,
    next,
  );

  refreshAggregateStatus();
}

function refreshAggregateStatus() {
  if (!jobs.length) {
    updateStatus({
      state: "idle",
      progress: 0,
      currentVolume: null,
      totalVolumes: 0,
      message: "",
    });

    return;
  }

  const pending =
    jobs.filter(
      (job) =>
        job.state ===
          "queued" ||
        job.state ===
          "running",
    );

  const totalVolumes =
    jobs.reduce(
      (total, job) =>
        total +
        job.input.files
          .length,
      0,
    );

  const weightedProgress =
    jobs.reduce(
      (total, job) =>
        total +
        job.progress *
          job.input.files
            .length,
      0,
    );

  const failed =
    jobs.filter(
      (job) =>
        job.state ===
        "error",
    );

  const completed =
    jobs.filter(
      (job) =>
        job.state ===
        "completed",
    );

  const running =
    jobs.filter(
      (job) =>
        job.state ===
        "running",
    );

  const queued =
    jobs.filter(
      (job) =>
        job.state ===
        "queued",
    );

  if (pending.length) {
    const parts = [
      running.length
        ? `${running.length} lote(s) processando`
        : "",

      queued.length
        ? `${queued.length} na fila`
        : "",

      completed.length
        ? `${completed.length} concluído(s)`
        : "",

      failed.length
        ? `${failed.length} com erro`
        : "",
    ].filter(Boolean);

    updateStatus({
      state: "running",

      progress:
        Math.round(
          weightedProgress /
            Math.max(
              totalVolumes,
              1,
            ),
        ),

      currentVolume:
        running[0]
          ?.currentVolume ??
        queued[0]
          ?.currentVolume ??
        null,

      totalVolumes,

      message:
        parts.join(
          " · ",
        ),
    });

    return;
  }

  updateStatus({
    state: failed.length
      ? "error"
      : "completed",

    progress:
      Math.round(
        weightedProgress /
          Math.max(
            totalVolumes,
            1,
          ),
      ),

    currentVolume: null,

    totalVolumes,

    message: failed.length
      ? `${completed.length} lote(s) concluído(s) · ${failed.length} com erro: ${failed[0]!.message}`
      : `${completed.length} lote(s), ${totalVolumes} publicação(ões) e ${completed.reduce(
          (total, job) =>
            total +
            job.totalPages,
          0,
        )} páginas publicados`,
  });
}



