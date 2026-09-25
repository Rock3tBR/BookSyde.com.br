import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { OpenBook3DModel } from "@/components/OpenBook3DModel";
import { supabase } from "@/integrations/supabase/client";
import { signReaderPreview, signReaderSource } from "@/lib/readerAccess";
import { useAuth } from "@/lib/auth";

type Volume = { id: string; file_format: string; page_count: number };
const publishedPreviewIds = new Set<string>();

/** The guest request never contains a Storage path or returns a complete EPUB. */
export function OpenBookPreview({
  coverUrl,
  title,
  synopsis,
  volume,
  mangaId,
  hasReadAccess = false,
  canPublishPreview = false,
}: {
  coverUrl: string | null;
  title: string;
  synopsis?: string | null;
  volume: Volume | undefined;
  mangaId?: string;
  hasReadAccess?: boolean;
  canPublishPreview?: boolean;
}) {
  const { session } = useAuth();
  const { data: pageTenUrl, isFetching, isError } = useQuery({
    queryKey: ["book-page-ten", volume?.id, volume?.file_format, title, hasReadAccess, session?.access_token],
    enabled: !!volume && (volume.file_format === "epub" || volume.page_count >= 10),
    staleTime: 50 * 60 * 1000,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!volume) return null;
      // An entitled reader can rasterize page 10 from the real EPUB. The
      // existing reader endpoint still enforces ownership before signing it.
      if (volume.file_format === "epub" && hasReadAccess) {
        const sourceUrl = await signReaderSource(volume.id);
        const source = await fetch(sourceUrl, { signal });
        if (!source.ok) throw new Error("Não foi possível baixar o EPUB.");
        const [{ readEpub }, { renderEpubPageTen }] = await Promise.all([
          import("@/lib/epub"),
          import("@/lib/epubPreview"),
        ]);
        const book = await readEpub(await source.blob());
        return renderEpubPageTen(book, title)?.imageUrl ?? null;
      }
      // A fixed preview request is safe for visitors: the server decides the
      // single page to expose (index 9) and checks the work's publication state.
      try {
        return await signReaderPreview(volume.id);
      } catch {
        return null;
      }
    },
  });

  // Backfill existing text EPUBs when their own creator/admin opens the work.
  // Save only the rasterized page, never the source file, in the cover bucket.
  useEffect(() => {
    if (
      !canPublishPreview || !hasReadAccess || !mangaId || !volume || volume.file_format !== "epub" ||
      !(pageTenUrl?.startsWith("data:image/") || pageTenUrl?.startsWith("blob:")) || publishedPreviewIds.has(volume.id)
    ) return;
    publishedPreviewIds.add(volume.id);
    const path = `${mangaId}/${volume.id}-preview-page-10.png`;
    void (async () => {
      try {
        const { epubPreviewToPng } = await import("@/lib/epubPreview");
        const blob = await epubPreviewToPng(pageTenUrl);
        if (!blob.size) return;
        const { error } = await supabase.storage
          .from("manga-covers")
          .upload(path, blob, { contentType: "image/png", upsert: true });
        if (error) throw error;
      } catch (error) {
        publishedPreviewIds.delete(volume.id);
        console.warn("Não foi possível salvar a amostra pública do EPUB:", error);
      }
    })();
  }, [canPublishPreview, hasReadAccess, mangaId, pageTenUrl, volume]);

  const pageStatus = isFetching
    ? "Preparando prévia…"
    : !volume
      ? "Sem volume publicado"
      : volume.file_format !== "epub" && volume.page_count < 10
        ? "Este volume tem menos de 10 páginas"
        : isError
          ? "A prévia não pôde ser carregada"
          : "Amostra em preparação";

  return (
    <OpenBook3DModel
      coverUrl={coverUrl}
      title={title}
      pageTenUrl={pageTenUrl ?? null}
      pageStatus={pageStatus}
      previewDescription={synopsis}
      pageLabel={volume?.file_format === "epub" ? `Página 10 da prévia de ${title}` : `Página 10 de ${title}`}
    />
  );
}
