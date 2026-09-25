import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/marketplace/order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return json({ error: "Não autorizado." }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !authData.user) return json({ error: "Sessão inválida." }, 401);

        const body = (await request.json().catch(() => ({}))) as {
          listingIds?: string[];
          mangaId?: string;
          source?: "marketplace" | "catalog";
          environment?: "sandbox" | "live";
        };

        if (body.environment !== "sandbox" && body.environment !== "live") {
          return json({ error: "Ambiente de pagamento inválido." }, 400);
        }

        // Catálogo administrado: cria o mesmo tipo de pedido usado pelo
        // Marketplace, mas o item nasce diretamente da obra pública do Admin.
        if (body.source === "catalog" || body.mangaId) {
          if (!body.mangaId || !/^[0-9a-f-]{36}$/i.test(body.mangaId)) {
            return json({ error: "Obra inválida." }, 400);
          }

          const { data, error } = await (supabaseAdmin as any).rpc("create_catalog_order_server", {
            _buyer_id: authData.user.id,
            _manga_id: body.mangaId,
            _environment: body.environment,
          });

          if (error) return json({ error: error.message }, 400);
          return json(data);
        }

        const listingIds = Array.from(new Set(body.listingIds ?? []));
        if (!listingIds.length || listingIds.length > 20) {
          return json({ error: "Selecione entre 1 e 20 itens." }, 400);
        }
        if (listingIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
          return json({ error: "Há uma publicação inválida na compra." }, 400);
        }

        // Esta RPC é server-only: o SQL de hardening revoga EXECUTE de
        // anon/authenticated e concede apenas ao service_role.
        const { data, error } = await (supabaseAdmin as any).rpc(
          "create_marketplace_order_server",
          {
            _buyer_id: authData.user.id,
            _listing_ids: listingIds,
            _environment: body.environment,
          },
        );

        if (error) return json({ error: error.message }, 400);
        return json(data);
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
