import { supabase } from "@/integrations/supabase/client";

// Only keep short-lived, bounded browser caches. A new session/token gets its
// own entries; permission checks still run on cache misses and in Storage.
export async function readerCacheKey(parts: unknown[]) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return JSON.stringify([data.session?.access_token ?? null, ...parts]);
}

export class ReaderCache<T> {
  private entries = new Map<string, { value: Promise<T>; expires: number }>();

  constructor(private ttl = 60_000, private limit = 128) {}

  get(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: Promise<T>) {
    if (typeof window === "undefined") return value;
    this.entries.delete(key);
    this.entries.set(key, { value, expires: Date.now() + this.ttl });
    while (this.entries.size > this.limit) {
      this.entries.delete(this.entries.keys().next().value!);
    }
    void value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    return value;
  }
}
