import { supabase } from "@/integrations/supabase/client";

/**
 * Compatibilidade temporária: mantemos os nomes das funções para não precisar
 * alterar todo o fluxo de publicação, mas os arquivos voltaram a ser gravados
 * exclusivamente no Supabase Storage.
 */
export async function uploadPrivateFileToR2(
  _mangaId: string,
  _volumeId: string,
  kind: "source" | "page",
  path: string,
  body: Blob,
  contentType: string,
) {
  const bucket = kind === "source" ? "volume-sources" : "manga-pages";
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: contentType || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(`Não foi possível enviar o arquivo ao Supabase Storage: ${error.message}`);
  return { ok: true as const, key: path };
}

export async function deletePrivateR2Files(entries: Array<{ bucket: string; path: string }>) {
  const grouped = new Map<string, string[]>();
  for (const entry of entries) {
    if (entry.bucket !== "manga-pages" && entry.bucket !== "volume-sources") continue;
    grouped.set(entry.bucket, [...(grouped.get(entry.bucket) ?? []), entry.path]);
  }
  for (const [bucket, paths] of grouped) {
    if (!paths.length) continue;
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw new Error(`Não foi possível remover arquivos do Supabase Storage: ${error.message}`);
  }
}
