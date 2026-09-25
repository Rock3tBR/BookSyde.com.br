import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { createSupabaseFetch } from "./api-key-fetch";

/** Uses the caller's JWT so database policies also apply to server routes. */
export function createRequestClient(token?: string) {
  // Keep the browser's URL/key pair together; runtime Cloud secrets may target another project.
  const publicUrl = import.meta.env.VITE_SUPABASE_URL || process.env["VITE_SUPABASE_URL"];
  const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  const usePublic = Boolean(publicUrl || publicKey);
  const url = usePublic ? publicUrl : process.env["SUPABASE_URL"];
  const key = usePublic ? publicKey : process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Configure a URL e a chave pública do Supabase no servidor.");
  return createClient<Database>(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
