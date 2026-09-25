import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/reader-pages")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const volumeId = url.searchParams.get("volumeId") ?? "";
        const fileId = url.searchParams.get("fileId") ?? "";
        const expires = Number(url.searchParams.get("expires") ?? 0);
        const sig = url.searchParams.get("sig") ?? "";
        const { fetchDriveFile, validateDriveProxy } = await import("@/lib/drive.server");
        if (!validateDriveProxy(volumeId, fileId, expires, sig)) {
          return Response.json({ error: "Link inválido ou expirado." }, { status: 403 });
        }
        const range = request.headers.get("range");
        const source = await fetchDriveFile(fileId, range, request.signal);
        if (source.status === 416) {
          const headers = new Headers();
          const contentRange = source.headers.get("content-range");
          if (contentRange) headers.set("Content-Range", contentRange);
          await source.body?.cancel();
          return new Response(null, { status: 416, headers });
        }
        if (!source.ok || !source.body) {
          const details = await source.text().catch(() => "");
          console.error("Google Drive download falhou", source.status, details.slice(0, 300));
          return Response.json({ error: `Google Drive recusou o arquivo (${source.status}).` }, { status: 502 });
        }
        const headers = new Headers();
        headers.set("Content-Type", source.headers.get("content-type") || "application/pdf");
        for (const name of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
          const value = source.headers.get(name);
          if (value) headers.set(name, value);
        }
        headers.set("Cache-Control", "private, max-age=300");
        headers.set("Content-Disposition", "inline");
        return new Response(source.body, { status: source.status === 206 ? 206 : 200, headers });
      },
      POST: async ({ request }) => {
        const { volumeId, paths, epub, preview } = (await request.json()) as {
          volumeId?: string;
          paths?: string[];
          epub?: boolean;
          preview?: boolean;
        };
        if (
          !volumeId ||
          (preview && (epub || paths !== undefined)) ||
          (!preview && !epub && (!Array.isArray(paths) || !paths.length || paths.length > 50))
        )
          return Response.json({ error: "Solicitação inválida." }, { status: 400 });
        const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
        const { createRequestClient } =
          await import("@/integrations/supabase/request-client.server");
        const db = createRequestClient(token);
        const respond = (body: unknown, status = 200) =>
          Response.json(body, {
            status,
            headers: { "Cache-Control": "no-store" },
          });
        // SQL and Storage both check the caller's rights; no service key is used.
        if (preview || epub) {
          let bucket = "volume-sources";
          let path: string | null = null;
          if (preview) {
            const result = await db.rpc("booksyde_reader_preview", { p_volume_id: volumeId });
            if (result.error) return respond({ error: result.error.message }, 400);
            bucket = result.data?.[0]?.bucket_id ?? "manga-pages";
            path = result.data?.[0]?.object_path ?? null;
          } else {
            // Primeiro usa a RPC (ela concentra as regras de autorização).
            // Em bancos que ainda estão com a versão anterior da função, a RPC
            // pode retornar null para PDFs do Google Drive. Nesse caso fazemos
            // fallback para uma leitura RLS-safe do próprio volume. A consulta
            // usa o JWT do usuário e, portanto, NÃO ignora as políticas do banco.
            const result = await db.rpc("booksyde_reader_source", { p_volume_id: volumeId });
            if (!result.error) path = result.data;

            if (!path) {
              const fallback = await db
                .from("volumes")
                .select("source_path,source_name,file_format")
                .eq("id", volumeId)
                .maybeSingle();
              if (fallback.error) return respond({ error: fallback.error.message }, 400);
              if (fallback.data?.file_format === "pdf") {
                const candidate = fallback.data.source_path || fallback.data.source_name || null;
                if (candidate?.startsWith("gdrive:")) path = candidate;
              }
            }

            if (path?.startsWith("gdrive:")) {
              const fileId = path.slice(7).trim();
              if (!/^[a-zA-Z0-9_-]+$/.test(fileId))
                return respond({ error: "ID do arquivo do Google Drive inválido." }, 400);
              const { createDriveProxyUrl } = await import("@/lib/drive.server");
              return respond({ url: createDriveProxyUrl(volumeId, fileId), provider: "google-drive" });
            }
            if (result.error && !path) return respond({ error: result.error.message }, 400);
          }
          if (!path)
            return respond({ error: "Publicação indisponível ou sem permissão de acesso." }, 403);
          if (preview) {
            const signed = await db.storage.from(bucket).createSignedUrl(path, 3600);
            if (signed.error) return respond({ error: signed.error.message }, 400);
            return respond({ url: signed.data.signedUrl });
          }
          const signed = await db.storage.from("volume-sources").createSignedUrl(path, 3600);
          if (signed.error) return respond({ error: signed.error.message }, 400);
          return respond({ url: signed.data.signedUrl, provider: "supabase" });
        }
        const result = await db.rpc("booksyde_reader_pages", { p_volume_ids: [volumeId] });
        if (result.error) return respond({ error: result.error.message }, 400);
        const allowed = new Set(result.data.map((page) => page.storage_path));
        if (!paths || paths.some((path) => !allowed.has(path)))
          return respond({ error: "Página inválida ou sem permissão de acesso." }, 403);
        const signed = await db.storage.from("manga-pages").createSignedUrls(paths, 3600);
        if (signed.error) return respond({ error: signed.error.message }, 400);
        const urls = Object.fromEntries(
          paths.map((path, index) => [path, signed.data?.[index]?.signedUrl ?? null]),
        );
        if (Object.values(urls).some((url) => !url))
          return respond({ error: "Não foi possível gerar o acesso a uma ou mais páginas." }, 400);
        return respond({ urls });
      },
    },
  },
});
