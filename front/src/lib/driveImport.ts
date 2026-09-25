import { supabase } from "@/integrations/supabase/client";
import type { UnitKind } from "@/lib/publication";

type DriveFile = { id: string; name: string; number: number; size?: string };
export async function driveRequest(url: string, init?: RequestInit) {
  const send = (token: string) => fetch(url, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const session = await supabase.auth.getSession();
  if (session.error) throw new Error("Não foi possível validar a sessão. Tente novamente.");
  if (!session.data.session) throw new Error("Sua sessão expirou. Faça login novamente.");
  let response = await send(session.data.session.access_token);
  if (response.status === 401) {
    const fresh = await supabase.auth.refreshSession();
    if (fresh.error) throw new Error("Não foi possível renovar a sessão. Faça login novamente.");
    if (!fresh.data.session) throw new Error("Sua sessão expirou. Faça login novamente.");
    response = await send(fresh.data.session.access_token);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (response.status === 401) throw new Error("Sua sessão expirou. Faça login novamente.");
    throw new Error(body?.error || "Falha na importação do Drive.");
  }
  return response;
}

export async function countPdfPages(data: Uint8Array) {
  if (!data.length || data.length > 500 * 1024 * 1024) throw new Error("O PDF deve ter conteúdo e no máximo 500 MB.");
  if (!new TextDecoder().decode(data.subarray(0, 1024)).includes("%PDF-")) throw new Error("O Drive não retornou um PDF válido. Confira o compartilhamento do arquivo.");
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data, isEvalSupported: false });
  try {
    const pdf = await task.promise;
    if (!Number.isSafeInteger(pdf.numPages) || pdf.numPages < 1) throw new Error("O PDF não contém páginas.");
    return pdf.numPages;
  } finally { await task.destroy(); }
}

export async function importDriveFolder(input: { mangaId: string; folderUrl: string; unitKind: UnitKind }, onProgress: (message: string) => void) {
  const readiness = await supabase.rpc("booksyde_drive_import_ready");
  if (readiness.error) throw new Error("Atualize o banco com a migração de importação do Drive antes de importar.");
  const response = await driveRequest("/api/drive-folder-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const { files } = await response.json() as { files: DriveFile[] };
  if (!Array.isArray(files) || !files.length) throw new Error("Nenhum arquivo encontrado.");
  let created = 0, updated = 0, skipped = 0;
  for (const [index, file] of files.entries()) {
    onProgress(`Processando ${index + 1}/${files.length}: ${file.name}`);
    try {
      const download = await driveRequest(`/api/drive-folder-sync?${new URLSearchParams({ mangaId: input.mangaId, fileId: file.id })}`);
      const bytes = new Uint8Array(await download.arrayBuffer());
      const size = bytes.byteLength;

      let pageCount = 0;
      if (/\.pdf$/i.test(file.name)) {
        pageCount = await countPdfPages(bytes);
      } else {
        const { extractPages } = await import("@/lib/mangaFile");
        const extracted = await extractPages(new File([bytes], file.name));
        pageCount = extracted.length;
      }

      const result = await supabase.rpc("booksyde_import_drive_volume", { p_manga_id: input.mangaId, p_file_id: file.id, p_name: file.name, p_number: file.number, p_unit_kind: input.unitKind, p_page_count: pageCount, p_size: size });
      if (result.error) throw new Error(result.error.message);
      if (result.data === "created") { created++; onProgress(`${file.name} criado(s)`); }
      else if (result.data === "updated") { updated++; onProgress(`${file.name} atualizado (páginas reparadas)`); }
      else if (result.data === "skipped") { skipped++; onProgress(`${file.name} preservado (já possui conteúdo)`); }
      else throw new Error("Resultado da importação não reconhecido.");
    } catch (error) {
      throw new Error(`${file.name}: ${error instanceof Error ? error.message : "falha ao importar"} ${created + updated} arquivo(s) concluído(s). Você pode repetir a importação para continuar.`);
    }
  }
  return { found: files.length, created, updated, skipped };
}
