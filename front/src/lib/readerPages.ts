import { supabase } from "@/integrations/supabase/client";
import { ReaderCache, readerCacheKey } from "@/lib/readerCache";

const pagesCache = new ReaderCache<Awaited<ReturnType<typeof fetchReaderPages>>>();

async function fetchReaderPages(volumeIds: string[], pageIndex?: number) {
  const { data, error } = await supabase.rpc("booksyde_reader_pages", {
    p_volume_ids: volumeIds,
    ...(pageIndex !== undefined ? { p_page_index: pageIndex } : {}),
  });
  if (error) throw error;
  return data ?? [];
}

/** The database checks ownership/purchase and publication before returning paths. */
export async function getReaderPages(volumeIds: string[], pageIndex?: number) {
  if (!volumeIds.length) return [];
  const key = await readerCacheKey([volumeIds, pageIndex ?? null]);
  return pagesCache.get(key) ?? pagesCache.set(key, fetchReaderPages(volumeIds, pageIndex));
}
