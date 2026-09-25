import { createFileRoute } from "@tanstack/react-router";
import { signR2Upload } from "@/lib/r2.server";

export const Route = createFileRoute("/api/r2-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
          if (!token) return Response.json({ error: "Não autenticado." }, { status: 401 });

          const mangaId = request.headers.get("x-booksyde-manga-id") ?? "";
          const volumeId = request.headers.get("x-booksyde-volume-id") ?? "";
          const kind = request.headers.get("x-booksyde-kind") ?? "";
          const path = decodeURIComponent(request.headers.get("x-booksyde-path") ?? "");
          const contentType = request.headers.get("content-type") || "application/octet-stream";

          if (!mangaId || !volumeId || !path || !["source", "page"].includes(kind)) {
            return Response.json({ error: "Solicitação de upload inválida." }, { status: 400 });
          }

          const expectedPrefix = `${mangaId}/${volumeId}/`;
          if (!path.startsWith(expectedPrefix) || path.includes("..")) {
            return Response.json({ error: "Caminho inválido." }, { status: 400 });
          }

          const { createRequestClient } = await import("@/integrations/supabase/request-client.server");
          const db = createRequestClient(token);
          const { data: auth } = await db.auth.getUser();
          if (!auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

          const { data: volume } = await db.from("volumes")
            .select("id,manga_id")
            .eq("id", volumeId)
            .eq("manga_id", mangaId)
            .maybeSingle();
          if (!volume) return Response.json({ error: "Volume não encontrado ou sem permissão." }, { status: 403 });

          const { data: work } = await db.from("mangas").select("creator_id").eq("id", mangaId).maybeSingle();
          const { data: roles } = await db.from("user_roles").select("role").eq("user_id", auth.user.id);
          const privileged = (roles ?? []).some((r: any) => ["admin", "publisher", "creator", "seller"].includes(String(r.role)));
          if (work?.creator_id !== auth.user.id && !privileged) {
            return Response.json({ error: "Sem permissão para enviar arquivos desta obra." }, { status: 403 });
          }

          const key = `${kind === "source" ? "sources" : "pages"}/${path}`;
          const signedUrl = await signR2Upload(key);

          // O upload é encaminhado pelo servidor do BookSyde. Isso evita que o
          // navegador precise acessar *.r2.cloudflarestorage.com diretamente e,
          // portanto, elimina a dependência de CORS no bucket privado.
          const body = await request.arrayBuffer();
          if (!body.byteLength) return Response.json({ error: "Arquivo vazio." }, { status: 400 });

          const uploaded = await fetch(signedUrl, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body,
          });

          if (!uploaded.ok) {
            const details = await uploaded.text().catch(() => "");
            console.error("R2 PUT falhou", uploaded.status, details);
            return Response.json({
              error: `Cloudflare R2 recusou o upload (${uploaded.status}).${details ? ` ${details.slice(0, 300)}` : ""}`,
            }, { status: 502 });
          }

          return Response.json({ ok: true, key });
        } catch (error) {
          console.error("Erro no upload R2:", error);
          return Response.json({ error: error instanceof Error ? error.message : "Falha inesperada no upload para o R2." }, { status: 500 });
        }
      },
    },
  },
});
