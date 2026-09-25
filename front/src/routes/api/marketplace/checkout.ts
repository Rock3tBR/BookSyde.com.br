import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";

function parseEnv(request: Request): StripeEnv | null {
  const env = new URL(request.url).searchParams.get("env");
  return env === "sandbox" || env === "live" ? env : null;
}

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: Response.json({ error: "Não autorizado." }, { status: 401 }) };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { error: Response.json({ error: "Sessão inválida." }, { status: 401 }) };
  }

  return { user: data.user, supabaseAdmin };
}

async function sellerUsesPlatformStripe(db: any, sellerId: string) {
  const { data, error } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", sellerId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return !!data;
}

export const Route = createFileRoute("/api/marketplace/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = parseEnv(request);
        if (!env) return Response.json({ error: "Ambiente Stripe inválido." }, { status: 400 });

        const auth = await authenticate(request);
        if ("error" in auth) return auth.error;
        const db = auth.supabaseAdmin as any;

        const body = (await request.json().catch(() => ({}))) as {
          orderId?: string;
          uiMode?: "hosted" | "embedded";
        };
        const uiMode = body.uiMode === "embedded" ? "embedded" : "hosted";

        if (!body.orderId || !/^[0-9a-f-]{36}$/i.test(body.orderId)) {
          return Response.json({ error: "Pedido inválido." }, { status: 400 });
        }

        const { data: order, error: orderError } = await db
          .from("marketplace_orders")
          .select(
            "id,buyer_id,seller_id,status,total_cents,currency,stripe_environment,stripe_account_id,checkout_session_id,checkout_url",
          )
          .eq("id", body.orderId)
          .maybeSingle();

        if (orderError || !order || order.buyer_id !== auth.user.id) {
          return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
        }
        if (order.stripe_environment !== env) {
          return Response.json({ error: "Este pedido pertence a outro ambiente de pagamento." }, { status: 409 });
        }
        if (order.status === "paid") {
          return Response.json({ error: "Este pedido já foi pago." }, { status: 409 });
        }
        if (order.status === "canceled" || order.status === "refunded") {
          return Response.json({ error: "Este pedido não pode mais ser pago." }, { status: 409 });
        }

        const platformSeller = await sellerUsesPlatformStripe(db, order.seller_id);
        let connectedAccountId: string | null = null;

        // O checkout embutido do Catálogo usa a conta principal da plataforma.
        // Vendedores Connect continuam no fluxo hospedado já existente.
        if (uiMode === "embedded" && !platformSeller) {
          return Response.json(
            { error: "O pagamento em popup está disponível para vendas do Catálogo administrado." },
            { status: 400 },
          );
        }

        if (!platformSeller) {
          const { data: seller, error: sellerError } = await db
            .from("marketplace_sellers")
            .select(
              "stripe_sandbox_account_id,stripe_live_account_id,sandbox_charges_enabled,live_charges_enabled",
            )
            .eq("user_id", order.seller_id)
            .maybeSingle();

          const currentAccountId =
            env === "live" ? seller?.stripe_live_account_id : seller?.stripe_sandbox_account_id;
          const currentChargesEnabled =
            env === "live" ? seller?.live_charges_enabled : seller?.sandbox_charges_enabled;

          if (sellerError || !currentAccountId || !currentChargesEnabled) {
            return Response.json(
              { error: "O vendedor não está disponível para receber pagamentos." },
              { status: 409 },
            );
          }

          connectedAccountId = order.stripe_account_id || currentAccountId;
        }

        const { data: items, error: itemsError } = await db
          .from("marketplace_order_items")
          .select("id,title,price_cents,currency")
          .eq("order_id", order.id)
          .order("created_at", { ascending: true });

        if (itemsError || !items?.length) {
          return Response.json({ error: "Este pedido não possui itens." }, { status: 400 });
        }

        const computedTotal = items.reduce(
          (sum: number, item: { price_cents: number }) => sum + Number(item.price_cents),
          0,
        );
        if (computedTotal !== Number(order.total_cents)) {
          return Response.json({ error: "O total do pedido está inconsistente." }, { status: 409 });
        }

        const stripe = createStripeClient(env);

        if (order.checkout_session_id) {
          try {
            const previous = platformSeller
              ? await stripe.checkout.sessions.retrieve(order.checkout_session_id)
              : await stripe.checkout.sessions.retrieve(
                  order.checkout_session_id,
                  undefined,
                  { stripeAccount: connectedAccountId! },
                );

            if (previous.status === "open") {
              if (uiMode === "embedded" && previous.ui_mode === "embedded" && previous.client_secret) {
                return Response.json({ clientSecret: previous.client_secret });
              }
              if (uiMode === "hosted" && previous.url) {
                return Response.json({ url: previous.url });
              }
            }
          } catch {
            // A sessão anterior expirou, foi removida ou pertence a uma conta antiga.
          }
        }

        const origin = new URL(request.url).origin;
        const socialReturn = `${origin}/social?friend=${order.seller_id}&order=${order.id}&payment=success`;
        const commonParams = {
          mode: "payment" as const,
          locale: "pt-BR" as const,
          client_reference_id: order.id,
          ...(auth.user.email ? { customer_email: auth.user.email } : {}),
          metadata: {
            marketplace_order_id: order.id,
            marketplace_buyer_id: order.buyer_id,
            marketplace_seller_id: order.seller_id,
            marketplace_environment: env,
            marketplace_payment_route: platformSeller ? "platform" : "connected_account",
          },
          payment_intent_data: {
            metadata: {
              marketplace_order_id: order.id,
              marketplace_buyer_id: order.buyer_id,
              marketplace_seller_id: order.seller_id,
              marketplace_environment: env,
              marketplace_payment_route: platformSeller ? "platform" : "connected_account",
            },
          },
          line_items: items.map((item: { title: string; price_cents: number }) => ({
            quantity: 1,
            price_data: {
              currency: "brl",
              unit_amount: item.price_cents,
              product_data: { name: item.title },
            },
          })),
        };

        let session: Stripe.Checkout.Session;

        if (uiMode === "embedded") {
          const embeddedParams = {
            ...commonParams,
            ui_mode: "embedded",
            return_url: socialReturn,
          } as Stripe.Checkout.SessionCreateParams;
          session = await stripe.checkout.sessions.create(embeddedParams);
        } else {
          const hostedParams: Stripe.Checkout.SessionCreateParams = {
            ...commonParams,
            success_url: socialReturn,
            cancel_url: `${origin}/social?friend=${order.seller_id}&order=${order.id}&payment=cancel`,
          };
          session = platformSeller
            ? await stripe.checkout.sessions.create(hostedParams)
            : await stripe.checkout.sessions.create(hostedParams, {
                stripeAccount: connectedAccountId!,
              });
        }

        const { error: updateError } = await db
          .from("marketplace_orders")
          .update({
            status: "awaiting_payment",
            stripe_account_id: platformSeller ? null : connectedAccountId,
            checkout_session_id: session.id,
            checkout_url: uiMode === "hosted" ? session.url : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .eq("buyer_id", auth.user.id)
          .eq("stripe_environment", env);

        if (updateError) {
          return Response.json({ error: updateError.message }, { status: 400 });
        }

        if (uiMode === "embedded") {
          if (!session.client_secret) {
            return Response.json(
              { error: "A Stripe não retornou o segredo do checkout embutido." },
              { status: 400 },
            );
          }
          return Response.json({ clientSecret: session.client_secret });
        }

        if (!session.url) {
          return Response.json({ error: "A Stripe não retornou o link de pagamento." }, { status: 400 });
        }
        return Response.json({ url: session.url });
      },
    },
  },
});
