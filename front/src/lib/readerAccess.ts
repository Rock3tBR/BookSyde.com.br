import { supabase } from "@/integrations/supabase/client";
import { getReaderPages } from "@/lib/readerPages";
import { ReaderCache, readerCacheKey } from "@/lib/readerCache";

const pageUrls = new ReaderCache<string>(300_000, 1024);

/**
 * A leitura usa diretamente o Supabase (RPC + Storage).
 * Não passa pelo servidor do BookSyde, Cloudflare R2 ou URLs do R2.
 */
export async function signReaderPages(volumeId: string, paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;

  const [allowedPages, scope] = await Promise.all([
    getReaderPages([volumeId]),
    readerCacheKey([volumeId]),
  ]);

  const allowed = new Set((allowedPages ?? []).map((page) => page.storage_path));
  if (paths.some((path) => !allowed.has(path))) {
    throw new Error("Página inválida ou sem permissão de acesso.");
  }

  const uniquePaths = [...new Set(paths)];
  const key = (path: string) => JSON.stringify([scope, path]);
  const pending = new Map(uniquePaths.map((path) => [path, pageUrls.get(key(path))]));
  const missing = uniquePaths.filter((path) => !pending.get(path));
  if (missing.length) {
    const batch = (async () => {
      const { data, error } = await supabase.storage.from("manga-pages").createSignedUrls(missing, 3600);
      if (error) throw new Error(error.message);
      if (missing.some((_, index) => !data?.[index]?.signedUrl)) {
        throw new Error("Não foi possível gerar o acesso a uma ou mais páginas.");
      }
      return data!;
    })();
    missing.forEach((path, index) => {
      pending.set(path, pageUrls.set(key(path), batch.then((data) => data[index]!.signedUrl!)));
    });
  }
  return Object.fromEntries(await Promise.all(uniquePaths.map(async (path) => [path, await pending.get(path)!])));
}

export async function signReaderSource(volumeId: string) {
  const { data: path, error: rpcError } = await supabase.rpc("booksyde_reader_source", {
    p_volume_id: volumeId,
  });
  if (rpcError) throw new Error(rpcError.message);
  if (!path) throw new Error("Publicação indisponível ou sem permissão de acesso.");

  const { data, error } = await supabase.storage.from("volume-sources").createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function signReaderPreview(volumeId: string) {
  const { data: preview, error: rpcError } = await supabase.rpc("booksyde_reader_preview", {
    p_volume_id: volumeId,
  });
  if (rpcError) throw new Error(rpcError.message);

  const item = preview?.[0];
  if (!item?.object_path) return null;
  const bucket = item.bucket_id || "manga-pages";
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(item.object_path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
