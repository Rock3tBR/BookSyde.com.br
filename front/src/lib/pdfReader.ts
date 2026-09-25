import { supabase } from "@/integrations/supabase/client";
import { ReaderCache } from "@/lib/readerCache";

const sourceUrls = new ReaderCache<string>();

async function pdfSourceUrl(volumeId: string, signal: AbortSignal) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  signal.throwIfAborted();
  const key = JSON.stringify([session?.access_token ?? null, volumeId]);
  const cached = sourceUrls.get(key);
  if (cached) return cached;
  const response = await fetch("/api/reader-pages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ volumeId, epub: true }),
    signal,
  });
  const result = await response.json();
  if (!response.ok || !result.url) throw new Error(result.error || "Não foi possível abrir o PDF.");
  // A stable URL also lets the browser reuse cached byte ranges on reopening.
  // Cache only completed requests: closing one reader must not abort another.
  return sourceUrls.set(key, Promise.resolve(result.url as string));
}

/** Load the decoder alongside authorization, then fetch PDF ranges on demand. */
export async function openReaderPdf(volumeId: string, signal: AbortSignal) {
  const [pdfjs, worker, url] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    pdfSourceUrl(volumeId, signal),
  ]);
  signal.throwIfAborted();
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({
    url,
    disableRange: false,
    // PDF.js requires both flags to avoid downloading unread pages in advance.
    disableStream: true,
    disableAutoFetch: true,
    rangeChunkSize: 262144,
  });
  const destroy = () => { void task.destroy().catch(() => {}); };
  signal.addEventListener("abort", destroy, { once: true });
  try {
    return await task.promise;
  } catch (error) {
    signal.removeEventListener("abort", destroy);
    destroy();
    throw error;
  }
}
