import { getReaderPages } from "@/lib/readerPages";
import { supabase } from "@/integrations/supabase/client";

const CACHE_NAME = "mangaka-offline-volumes-v1";
const DATABASE_NAME = "mangaka-offline-library";
const DATABASE_VERSION = 1;
const PAGE_STORE = "pages";
const INDEX_KEY = "mangaka-offline-volumes";
const DOWNLOAD_EVENT = "mangaka-offline-download";

export type OfflineDownloadStatus = {
  volumeId: string;
  label: string;
  completed: number;
  total: number;
  state: "queued" | "downloading" | "complete" | "error";
  error?: string;
};

const downloads = new Map<string, OfflineDownloadStatus>();
const tasks = new Map<string, Promise<void>>();

function publishDownload(status: OfflineDownloadStatus) {
  downloads.set(status.volumeId, status);
  window.dispatchEvent(new CustomEvent(DOWNLOAD_EVENT, { detail: status }));
}

export function publishDirectDownload(status: OfflineDownloadStatus) {
  publishDownload(status);
}

export function dismissDirectDownload(volumeId: string, delay = 3500) {
  window.setTimeout(() => {
    downloads.delete(volumeId);
    window.dispatchEvent(new Event(DOWNLOAD_EVENT));
  }, delay);
}

export function getOfflineDownloads() {
  return [...downloads.values()];
}

export function subscribeOfflineDownloads(listener: () => void) {
  window.addEventListener(DOWNLOAD_EVENT, listener);
  return () => window.removeEventListener(DOWNLOAD_EVENT, listener);
}

export async function cacheOfflineAppShell() {
  if (!("caches" in window) || !navigator.onLine) return;
  const cache = await caches.open("mangaka-runtime-assets-v1");
  const resourceUrls = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((url) => {
      const parsed = new URL(url, window.location.origin);
      return (
        parsed.origin === window.location.origin && /\.(?:js|css)(?:\?|$)/.test(parsed.pathname)
      );
    });
  const urls = [...new Set(resourceUrls)];
  // Com URLs versionadas pelo Vite, JS/CSS já armazenados não precisam de rede.
  // Quatro workers evitam uma rajada de solicitações durante a navegação.
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, urls.length) }, async () => {
      while (next < urls.length) {
        const url = urls[next++];
        if (!url) continue;
        try {
          if (await cache.match(url)) continue;
          const response = await fetch(url, { cache: "force-cache" });
          if (response.ok) await cache.put(url, response);
        } catch {
          // O armazenamento é uma melhoria opcional, não bloqueia a leitura.
        }
      }
    }),
  );
}

export type OfflinePage = {
  id: string;
  page_index: number;
  storage_path: string;
};

export type OfflineVolume = {
  volumeId: string;
  volumeNumber: number;
  mangaId: string;
  mangaSlug: string;
  mangaTitle: string;
  workType?: "manga" | "hq" | "gibi" | "book" | undefined;
  fileFormat?: "images" | "epub" | undefined;
  downloadedAt: string;
  pages: OfflinePage[];
};

function pageRequest(volumeId: string, pageIndex: number) {
  return new Request(`${window.location.origin}/__mangaka-offline/${volumeId}/${pageIndex}`);
}

function pageKey(volumeId: string, pageIndex: number) {
  return `${volumeId}:${pageIndex}`;
}

function openOfflineDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador não oferece armazenamento offline persistente."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PAGE_STORE)) {
        request.result.createObjectStore(PAGE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Falha ao abrir a biblioteca offline."));
  });
}

async function writeOfflineBlob(key: string, blob: Blob) {
  const database = await openOfflineDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PAGE_STORE, "readwrite");
    transaction.objectStore(PAGE_STORE).put(blob, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Falha ao salvar página."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Download interrompido."));
  });
  database.close();
}

async function readOfflineBlob(key: string) {
  try {
    const database = await openOfflineDatabase();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(PAGE_STORE, "readonly");
      const request = transaction.objectStore(PAGE_STORE).get(key);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error("Falha ao ler página offline."));
    });
    database.close();
    return blob;
  } catch {
    return null;
  }
}

function writeOfflinePage(volumeId: string, pageIndex: number, blob: Blob) {
  return writeOfflineBlob(pageKey(volumeId, pageIndex), blob);
}

function readOfflinePage(volumeId: string, pageIndex: number) {
  return readOfflineBlob(pageKey(volumeId, pageIndex));
}

function epubKey(volumeId: string) {
  return `${volumeId}:epub`;
}

/** Arquivo ePub guardado no aparelho, quando o livro foi baixado. */
export async function getOfflineEpub(volumeId: string) {
  if (typeof window === "undefined") return null;
  return readOfflineBlob(epubKey(volumeId));
}

function safeDownloadName(fileName: string) {
  const cleaned = fileName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.toLowerCase().endsWith(".epub") ? cleaned : `${cleaned || "livro"}.epub`;
}

/**
 * Baixa o EPUB original inteiro para o dispositivo.
 * Diferente do modo offline, isto cria um arquivo .epub real no aparelho.
 */
export async function downloadEpubFile({
  volumeId,
  fileName,
}: {
  volumeId: string;
  fileName: string;
}) {
  if (typeof window === "undefined") throw new Error("Download disponível apenas no navegador.");
  if (!navigator.onLine) throw new Error("Conecte-se à internet para baixar o livro.");

  publishDownload({ volumeId, label: fileName, completed: 0, total: 1, state: "queued" });
  try {
    const { signReaderSource } = await import("@/lib/readerAccess");
    const signedUrl = await signReaderSource(volumeId);
    publishDownload({ volumeId, label: fileName, completed: 0, total: 1, state: "downloading" });

    const source = await fetch(signedUrl, { cache: "no-store" });
    if (!source.ok) throw new Error("Não foi possível baixar o arquivo completo do livro.");

    const blob = await source.blob();
    if (!blob.size) throw new Error("O arquivo do livro veio vazio.");

    const url = URL.createObjectURL(
      new Blob([blob], { type: "application/epub+zip" }),
    );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeDownloadName(fileName);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    publishDownload({ volumeId, label: fileName, completed: 1, total: 1, state: "complete" });
    dismissDirectDownload(volumeId);
  } catch (error) {
    publishDownload({
      volumeId, label: fileName, completed: 0, total: 1, state: "error",
      error: error instanceof Error ? error.message : "Falha no download",
    });
    throw error;
  }
}

async function deleteOfflinePages(volumeId: string, pages: OfflinePage[]) {
  try {
    const database = await openOfflineDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PAGE_STORE, "readwrite");
      const store = transaction.objectStore(PAGE_STORE);
      pages.forEach((page) => store.delete(pageKey(volumeId, page.page_index)));
      store.delete(epubKey(volumeId));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Falha ao remover páginas."));
    });
    database.close();
  } catch {
    // Downloads antigos podem existir somente no Cache Storage.
  }
}

function readIndex(): OfflineVolume[] {
  try {
    return JSON.parse(window.localStorage.getItem(INDEX_KEY) ?? "[]") as OfflineVolume[];
  } catch {
    return [];
  }
}

function writeIndex(volumes: OfflineVolume[]) {
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(volumes));
  window.dispatchEvent(new Event("mangaka-offline-updated"));
}

export function getOfflineVolume(volumeId: string) {
  if (typeof window === "undefined") return null;
  return readIndex().find((volume) => volume.volumeId === volumeId) ?? null;
}

export function getOfflineVolumeIds() {
  if (typeof window === "undefined") return [];
  return readIndex().map((volume) => volume.volumeId);
}

type DownloadOptions = {
  volumeId: string;
  volumeNumber: number;
  mangaId: string;
  mangaSlug: string;
  mangaTitle: string;
  workType?: "manga" | "hq" | "gibi" | "book" | undefined;
  fileFormat?: "images" | "epub" | undefined;
  onProgress?: ((completed: number, total: number) => void) | undefined;
};

export async function downloadVolumeOffline(options: DownloadOptions) {
  const running = tasks.get(options.volumeId);
  if (running) return running;

  const task = performDownload(options);
  tasks.set(options.volumeId, task);
  void task.then(
    () => tasks.delete(options.volumeId),
    () => tasks.delete(options.volumeId),
  );
  return task;
}

async function performDownload({
  volumeId,
  volumeNumber,
  mangaId,
  mangaSlug,
  mangaTitle,
  workType,
  fileFormat,
  onProgress,
}: DownloadOptions) {
  if (!("caches" in window) && !("indexedDB" in window)) {
    throw new Error("Este navegador não oferece armazenamento offline.");
  }

  publishDownload({
    volumeId,
    label: `Volume: ${volumeNumber}`,
    completed: 0,
    total: 0,
    state: "queued",
  });

  try {
    // Carrega o módulo do leitor enquanto há rede; o service worker guarda o
    // chunk para que um volume baixado abra mesmo após reiniciar o PWA offline.
    await Promise.all([
      import("@/routes/ler.$volumeId"),
      import("@/pages/ler.$volumeId"),
      import("@/components/OfflineMode"),
      ...(fileFormat === "epub" ? [import("@/components/EpubReader")] : []),
    ]);
    await cacheOfflineAppShell();

    if (fileFormat === "epub") {
      publishDownload({
        volumeId,
        label: `Volume: ${volumeNumber} · livro completo`,
        completed: 0,
        total: 1,
        state: "downloading",
      });
      onProgress?.(0, 1);

      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch("/api/reader-pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData.session
            ? { Authorization: `Bearer ${sessionData.session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ volumeId, epub: true }),
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Não foi possível baixar o livro.");
      }
      const source = await fetch(result.url);
      if (!source.ok) throw new Error("Não foi possível baixar o livro.");
      const blob = await source.blob();
      if (!blob.size) throw new Error("O arquivo do livro veio vazio.");
      await writeOfflineBlob(epubKey(volumeId), blob);

      const offlineBook: OfflineVolume = {
        volumeId,
        volumeNumber,
        mangaId,
        mangaSlug,
        mangaTitle,
        workType,
        fileFormat: "epub",
        downloadedAt: new Date().toISOString(),
        pages: [],
      };
      writeIndex([...readIndex().filter((volume) => volume.volumeId !== volumeId), offlineBook]);
      await fetch(`/ler/${volumeId}`).catch(() => undefined);
      onProgress?.(1, 1);
      publishDownload({
        volumeId,
        label: `Volume: ${volumeNumber}`,
        completed: 1,
        total: 1,
        state: "complete",
      });
      window.setTimeout(() => {
        downloads.delete(volumeId);
        window.dispatchEvent(new Event(DOWNLOAD_EVENT));
      }, 3500);
      return;
    }

    const pages = await getReaderPages([volumeId]);
    if (!pages?.length) throw new Error("Este volume não possui páginas para baixar.");

    publishDownload({
      volumeId,
      label: `Volume: ${volumeNumber}`,
      completed: 0,
      total: pages.length,
      state: "downloading",
    });

    const { data: signedPages, error: signedError } = await supabase.storage
      .from("manga-pages")
      .createSignedUrls(
        pages.map((page) => page.storage_path),
        60 * 60,
      );
    if (signedError) throw signedError;

    for (let index = 0; index < pages.length; index += 1) {
      const signedUrl = signedPages?.[index]?.signedUrl;
      if (!signedUrl) throw new Error(`Não foi possível preparar a página ${index + 1}.`);
      const response = await fetch(signedUrl);
      if (!response.ok) throw new Error(`Falha ao baixar a página ${index + 1}.`);
      const blob = await response.blob();
      if (!blob.size) throw new Error(`A página ${index + 1} foi recebida vazia.`);
      await writeOfflinePage(volumeId, pages[index]!.page_index, blob);
      onProgress?.(index + 1, pages.length);
      publishDownload({
        volumeId,
        label: `Volume: ${volumeNumber}`,
        completed: index + 1,
        total: pages.length,
        state: "downloading",
      });
    }

    const offlineVolume: OfflineVolume = {
      volumeId,
      volumeNumber,
      mangaId,
      mangaSlug,
      mangaTitle,
      workType,
      downloadedAt: new Date().toISOString(),
      pages,
    };
    writeIndex([...readIndex().filter((volume) => volume.volumeId !== volumeId), offlineVolume]);
    // Faz o service worker guardar a rota do leitor; o shell pode então abrir sem rede.
    await fetch(`/ler/${volumeId}`).catch(() => undefined);
    publishDownload({
      volumeId,
      label: `Volume: ${volumeNumber}`,
      completed: pages.length,
      total: pages.length,
      state: "complete",
    });
    window.setTimeout(() => {
      downloads.delete(volumeId);
      window.dispatchEvent(new Event(DOWNLOAD_EVENT));
    }, 3500);
  } catch (error) {
    publishDownload({
      volumeId,
      label: `Volume: ${volumeNumber}`,
      completed: downloads.get(volumeId)?.completed ?? 0,
      total: downloads.get(volumeId)?.total ?? 0,
      state: "error",
      error: error instanceof Error ? error.message : "Falha no download",
    });
    throw error;
  }
}

export async function removeOfflineVolume(volumeId: string) {
  const volume = getOfflineVolume(volumeId);
  await deleteOfflinePages(volumeId, volume?.pages ?? []);
  if ("caches" in window) {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(
      (volume?.pages ?? []).map((page) => cache.delete(pageRequest(volumeId, page.page_index))),
    );
  }
  writeIndex(readIndex().filter((volume) => volume.volumeId !== volumeId));
}

export async function getOfflinePageUrls(volumeId: string, pages: OfflinePage[]) {
  if (typeof window === "undefined") return pages.map(() => null);
  const cache = "caches" in window ? await caches.open(CACHE_NAME) : null;
  return Promise.all(
    pages.map(async (page) => {
      const storedBlob = await readOfflinePage(volumeId, page.page_index);
      if (storedBlob) return URL.createObjectURL(storedBlob);
      // Compatibilidade com volumes baixados antes da migração para IndexedDB.
      const response = await cache?.match(pageRequest(volumeId, page.page_index));
      return response ? URL.createObjectURL(await response.blob()) : null;
    }),
  );
}
