import { useQuery } from "@tanstack/react-query";
import { getOfflinePageUrls } from "@/lib/offlineVolumes";
import { signReaderPages } from "@/lib/readerAccess";

export function ReaderImagePreview({
  volumeId,
  page,
  cachedUrl,
}: {
  volumeId: string;
  page: { id: string; storage_path: string; page_index: number };
  cachedUrl?: string | undefined;
}) {
  const { data: url, error } = useQuery({
    queryKey: ["reader-page-preview", volumeId, page.id, cachedUrl],
    queryFn: async () => {
      if (cachedUrl) return cachedUrl;
      const offline = await getOfflinePageUrls(volumeId, [page]);
      if (offline[0]) return offline[0];
      if (!navigator.onLine) throw new Error("Prévia indisponível offline.");
      return (await signReaderPages(volumeId, [page.storage_path]))[page.storage_path];
    },
    staleTime: 50 * 60 * 1000,
    retry: false,
  });
  return url ? (
    <img
      src={url}
      alt="Prévia da página selecionada"
      className="max-h-[220px] max-w-[180px] object-contain"
    />
  ) : (
    <p className="max-w-40 p-3 text-center text-xs text-white/60">
      {error ? "Prévia indisponível" : "Carregando prévia…"}
    </p>
  );
}
