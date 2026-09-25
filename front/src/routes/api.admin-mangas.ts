import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin-mangas")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
        if (!token) return Response.json({ error: "Não autorizado." }, { status: 401 });
        const { createRequestClient } =
          await import("@/integrations/supabase/request-client.server");
        const db = createRequestClient(token);
        const { data: auth, error: authError } = await db.auth.getUser(token);
        if (authError || !auth.user)
          return Response.json({ error: "Sessão inválida." }, { status: 401 });
        const body = (await request.json()) as {
          mangaId?: string;
          volumeId?: string;
          reason?: string;
          details?: string;
        };
        const { error } = await db.rpc("booksyde_delete_publication", {
          ...(body.mangaId ? { p_manga_id: body.mangaId } : {}),
          ...(body.volumeId ? { p_volume_id: body.volumeId } : {}),
          ...(body.reason ? { p_reason: body.reason } : {}),
          ...(body.details ? { p_details: body.details } : {}),
        });
        if (error) {
          const missing = error.code === "PGRST202" || error.code === "42883";
          return Response.json(
            {
              error: missing
                ? "Aplique SQL_REPARAR_CRUD.sql no Supabase antes de excluir publicações."
                : error.message,
            },
            { status: missing ? 503 : error.code === "42501" ? 403 : 400 },
          );
        }
        // Only the database can create cleanup receipts. Retry previous pending
        // files too; a Storage failure never turns a committed deletion into failure.
        let cleanupFailed = false;
        try {
          for (;;) {
            const pending = await db
              .from("publication_cleanup")
              .select("id,bucket_id,object_path")
              .eq("requested_by", auth.user.id)
              .order("created_at")
              .limit(100);
            if (pending.error) {
              cleanupFailed = true;
              break;
            }
            if (!pending.data?.length) break;
            for (const bucket of new Set(pending.data.map((item) => item.bucket_id))) {
              const items = pending.data.filter((item) => item.bucket_id === bucket);
              const removed = await db.storage
                .from(bucket)
                .remove(items.map((item) => item.object_path));
              if (removed.error) {
                cleanupFailed = true;
                continue;
              }
              const receipt = await db
                .from("publication_cleanup")
                .delete()
                .in(
                  "id",
                  items.map((item) => item.id),
                );
              if (receipt.error) cleanupFailed = true;
            }
            if (cleanupFailed) break;
          }
        } catch {
          cleanupFailed = true;
        }
        return Response.json({
          ok: true,
          warning: cleanupFailed
            ? "Publicação apagada. Alguns arquivos aguardam uma nova tentativa de limpeza."
            : null,
        });
      },
    },
  },
});
