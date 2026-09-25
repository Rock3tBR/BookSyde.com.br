import { supabase } from "@/integrations/supabase/client";

export const STORAGE_PREFIX = "storage:";

/** Cover URLs are either a static path (/images/...) or "storage:<path>" in the covers bucket. */
export async function resolveCoverUrl(coverUrl: string | null): Promise<string | null> {
  if (!coverUrl) return null;
  if (!coverUrl.startsWith(STORAGE_PREFIX)) return coverUrl;
  const path = coverUrl.slice(STORAGE_PREFIX.length);
  // Capas são mídia pública do catálogo/marketplace. Usar URL pública evita
  // que a renderização dependa de uma policy SELECT ou da expiração de URL assinada.
  const { data } = supabase.storage.from("manga-covers").getPublicUrl(path);
  return data.publicUrl || null;
}

export function freeSampleCount(pageCount: number) {
  return Math.max(1, Math.ceil(pageCount * 0.25));
}

export function formatPrice(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}
