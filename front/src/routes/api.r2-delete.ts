import { createFileRoute } from "@tanstack/react-router";
import { deleteR2Objects } from "@/lib/r2.server";

export const Route = createFileRoute("/api/r2-delete")({ server: { handlers: { POST: async ({ request }) => {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return Response.json({ error: "Não autenticado." }, { status: 401 });
  const { createRequestClient } = await import("@/integrations/supabase/request-client.server");
  const db = createRequestClient(token);
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const body = await request.json() as { objects?: Array<{ bucket: string; path: string }> };
  const objects = (body.objects ?? []).slice(0, 100).filter((x) => x?.path && ["manga-pages", "volume-sources"].includes(x.bucket));
  // Deletion is limited to paths whose volume belongs to a work visible to the caller through existing RLS.
  const allowedKeys: string[] = [];
  for (const item of objects) {
    const parts = item.path.split("/");
    if (parts.length < 3 || parts.includes("..")) continue;
    const [mangaId, volumeId] = parts;
    const { data: volume } = await db.from("volumes").select("id").eq("id", volumeId).eq("manga_id", mangaId).maybeSingle();
    if (volume) allowedKeys.push(`${item.bucket === "volume-sources" ? "sources" : "pages"}/${item.path}`);
  }
  try { await deleteR2Objects(allowedKeys); return Response.json({ ok: true }); }
  catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Falha ao excluir do R2." }, { status: 500 }); }
} } } });
