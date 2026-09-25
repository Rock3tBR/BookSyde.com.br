import { supabase } from "@/integrations/supabase/client";

export type ReaderProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  user_code: string | null;
};

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };
const db = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
  from: (table: string) => any;
};

export function normalizeReaderSearch(value: string): string {
  return value.trim().replace(/^#\s*/, "").replace(/\s+/g, " ").slice(0, 64).trim();
}

function isMissingFunction(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST202" || error.code === "42883";
}

/**
 * A função SQL expõe apenas dados de descoberta e não libera a tabela de perfis.
 * O fallback permite que a busca continue em instalações antigas com uma policy
 * de perfis públicos; a UI sinaliza explicitamente quando falta a migração.
 */
export async function searchReaders(query: string, currentUserId: string, limit = 12): Promise<{
  profiles: ReaderProfile[];
  needsMigration: boolean;
}> {
  const term = normalizeReaderSearch(query);
  if (term.length < 2) return { profiles: [], needsMigration: false };

  const { data, error } = await db.rpc("search_readers", {
    _query: term,
    _max_results: Math.max(1, Math.min(limit, 12)),
  });
  if (!error) return { profiles: (data ?? []) as ReaderProfile[], needsMigration: false };
  if (!isMissingFunction(error)) throw new Error(error.message);

  // Compatibilidade: não permitir caracteres especiais do filtro PostgREST.
  // No fallback, procuramos separadamente por nome e por código completo.
  const safeTerm = term.replace(/[%_\\*,().]/g, " ").trim();
  if (!safeTerm) return { profiles: [], needsMigration: true };
  const [byName, byCode] = await Promise.all([
    db.from("profiles")
      .select("id,display_name,avatar_url,user_code")
      .ilike("display_name", `%${safeTerm}%`)
      .neq("id", currentUserId)
      .limit(limit),
    db.from("profiles")
      .select("id,display_name,avatar_url,user_code")
      .ilike("user_code", safeTerm)
      .neq("id", currentUserId)
      .limit(limit),
  ]);
  if (byName.error) throw new Error(byName.error.message);
  if (byCode.error) throw new Error(byCode.error.message);
  const unique = new Map<string, ReaderProfile>();
  for (const row of [...(byCode.data ?? []), ...(byName.data ?? [])] as ReaderProfile[]) {
    if (row.id !== currentUserId) unique.set(row.id, row);
  }
  return { profiles: [...unique.values()].slice(0, limit), needsMigration: true };
}

/** Lê somente perfis relacionados ao usuário autenticado. */
export async function getReaderProfiles(ids: string[]): Promise<ReaderProfile[]> {
  if (!ids.length) return [];
  const { data, error } = await db.rpc("get_reader_profiles", { _ids: ids.slice(0, 200) });
  if (!error) return (data ?? []) as ReaderProfile[];
  if (!isMissingFunction(error)) throw new Error(error.message);

  // Mantém suporte a instalações ainda não migradas, respeitando a RLS existente.
  const fallback = await db.from("profiles")
    .select("id,display_name,avatar_url,user_code")
    .in("id", ids.slice(0, 200));
  if (fallback.error) throw new Error(fallback.error.message);
  return (fallback.data ?? []) as ReaderProfile[];
}
