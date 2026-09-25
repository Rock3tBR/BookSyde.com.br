import { createFileRoute } from "@tanstack/react-router";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function authorize(request: Request, mangaId: unknown) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { error: json({ error: "Sua sessão expirou. Faça login novamente." }, 401) };
  if (typeof mangaId !== "string" || !mangaId) return { error: json({ error: "Escolha a obra." }, 400) };
  const { createRequestClient } = await import("@/integrations/supabase/request-client.server");
  const db = createRequestClient(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return { error: json({ error: "Não foi possível validar a sessão." }, error && (!error.status || error.status >= 500) ? 503 : 401) };
  const work = await db.from("mangas").select("id,creator_id,work_type,is_collection").eq("id", mangaId).maybeSingle();
  if (work.error) throw new Error(work.error.message);
  if (!work.data) return { error: json({ error: "Obra não encontrada ou sem permissão." }, 404) };
  if (work.data.creator_id !== data.user.id) {
    const roles = await db.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin");
    if (roles.error) throw new Error(roles.error.message);
    if (!roles.data?.length) return { error: json({ error: "Sem permissão para importar nesta obra." }, 403) };
  }
  return { db, work: work.data };
}

export const Route = createFileRoute("/api/drive-folder-sync")({ server: { handlers: {
  POST: async ({ request }) => {
    try {
      const body = await request.json().catch(() => null);
      const auth = await authorize(request, body?.mangaId);
      if (auth.error) return auth.error;
      if (typeof body?.folderUrl !== "string" || !["volume", "chapter"].includes(body?.unitKind)) return json({ error: "Informe a pasta e selecione volume ou capítulo." }, 400);
      const { extractDriveFolderId, listDriveFolder } = await import("@/lib/drive.server");
      const folderId = extractDriveFolderId(body.folderUrl);
      if (!folderId) return json({ error: "Link de pasta do Google Drive inválido." }, 400);
      const files = (await listDriveFolder(folderId)).filter(f => /\.pdf$/i.test(f.name)).map(f => {
        const name = f.name.replace(/\.pdf$/i, "");
        const match = name.match(/(?:vol(?:ume)?|cap(?:[íi]tulo)?|chapter|ch|#)[\s._-]*(\d+(?:\.\d+)?)/i) ?? name.match(/(?:^|\D)(\d+(?:\.\d+)?)(?:\D|$)/);
        return { ...f, number: match ? Number(match[1]) : NaN };
      }).filter(f => Number.isFinite(f.number)).sort((a,b) => a.number-b.number);
      if (!files.length) return json({ error: "Nenhum PDF numerado encontrado. Use VOL.01.pdf ou Capítulo 01.pdf e compartilhe a pasta como 'Qualquer pessoa com o link'." }, 400);
      if (files.some(f => !Number.isSafeInteger(f.number) || f.number < 0 || f.number > 2147483647) || new Set(files.map(f => f.number)).size !== files.length) return json({ error: "Corrija os números dos PDFs: use inteiros únicos." }, 400);
      if (auth.work!.work_type === "book" && !auth.work!.is_collection && (files.length !== 1 || files[0]!.number !== 1 || body.unitKind !== "volume")) return json({ error: "Livro individual aceita somente um PDF como volume 1." }, 400);
      // Listing does not create empty volumes. The browser counts each PDF before saving.
      return json({ files });
    } catch (error) { return json({ error: error instanceof Error ? error.message : "Falha ao ler a pasta." }, 503); }
  },
  GET: async ({ request }) => {
    try {
      const url = new URL(request.url);
      const auth = await authorize(request, url.searchParams.get("mangaId"));
      if (auth.error) return auth.error;
      const fileId = url.searchParams.get("fileId") ?? "";
      if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) return json({ error: "Arquivo inválido." }, 400);
      const { fetchDriveFile } = await import("@/lib/drive.server");
      const file = await fetchDriveFile(fileId);
      if (!file.ok || !file.body) return json({ error: "Não foi possível baixar o PDF. Confira o compartilhamento do arquivo no Drive." }, 502);
      if (Number(file.headers.get("content-length")) > 500 * 1024 * 1024) return json({ error: "O PDF excede 500 MB." }, 413);
      return new Response(file.body, { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
    } catch { return json({ error: "Falha ao baixar o PDF do Drive. Tente novamente." }, 503); }
  },
} } });
