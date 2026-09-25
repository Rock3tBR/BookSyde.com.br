import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

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

async function handlePaidSession(
  session: Stripe.Checkout.Session,
  eventAccount: string | null | undefined,
  env: StripeEnv,
) {
  const orderId = session.metadata?.["marketplace_order_id"];
  if (!orderId) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const { data: order, error: orderError } = await db
    .from("marketplace_orders")
    .select("id,seller_id,status,total_cents,currency,stripe_environment,stripe_account_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) throw new Error("Marketplace order not found");
  if (order.stripe_environment !== env) throw new Error("Marketplace environment mismatch");

  const platformSeller = await sellerUsesPlatformStripe(db, order.seller_id);

  if (platformSeller) {
    // Cobranças da conta admin nascem na própria conta Stripe da plataforma.
    // Nesses eventos não existe event.account de uma conta Connect.
    if (order.stripe_account_id || eventAccount) {
      throw new Error("Platform marketplace order received a connected-account event");
    }
  } else if (!order.stripe_account_id || eventAccount !== order.stripe_account_id) {
    throw new Error("Connected account does not match marketplace order");
  }

  if (Number(session.amount_total ?? -1) !== Number(order.total_cents)) {
    throw new Error("Marketplace payment amount mismatch");
  }
  if ((session.currency ?? "").toUpperCase() !== String(order.currency).toUpperCase()) {
    throw new Error("Marketplace payment currency mismatch");
  }

  const { error } = await db.rpc("fulfill_marketplace_order", {
    _order_id: order.id,
    _stripe_session_id: session.id,
  });
  if (error) throw new Error(error.message);

  // O pagamento já foi validado e o pedido foi entregue. A notificação é
  // best-effort: uma falha de e-mail nunca deve desfazer/invalidar a venda.
  try {
    const supabaseUrl = process.env["SUPABASE_URL"];
    const serviceRole = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (supabaseUrl && serviceRole) {
      const response = await fetch(`${supabaseUrl}/functions/v1/notify-seller-sale`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRole}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId: order.id }),
      });
      if (!response.ok) console.error("Seller email notification failed:", await response.text());
    }
  } catch (notificationError) {
    console.error("Seller email notification failed:", notificationError);
  }
}

async function handleExpiredSession(session: Stripe.Checkout.Session, env: StripeEnv) {
  const orderId = session.metadata?.["marketplace_order_id"];
  if (!orderId) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  await db
    .from("marketplace_orders")
    .update({
      status: "expired",
      checkout_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("stripe_environment", env)
    .eq("checkout_session_id", session.id)
    .neq("status", "paid");
}

async function handleAccountUpdated(account: Stripe.Account, env: StripeEnv) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const accountColumn = env === "live" ? "stripe_live_account_id" : "stripe_sandbox_account_id";
  const values =
    env === "live"
      ? {
          live_charges_enabled: !!account.charges_enabled,
          live_payouts_enabled: !!account.payouts_enabled,
          live_details_submitted: !!account.details_submitted,
          updated_at: new Date().toISOString(),
        }
      : {
          sandbox_charges_enabled: !!account.charges_enabled,
          sandbox_payouts_enabled: !!account.payouts_enabled,
          sandbox_details_submitted: !!account.details_submitted,
          updated_at: new Date().toISOString(),
        };

  await db.from("marketplace_sellers").update(values).eq(accountColumn, account.id);
}

async function handleWebhook(request: Request, env: StripeEnv) {
  const event = await verifyWebhook(request, env, "marketplace");
  const eventAccount = "account" in event ? event.account : undefined;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
        await handlePaidSession(session, eventAccount, env);
      }
      break;
    }
    case "checkout.session.async_payment_succeeded":
      await handlePaidSession(event.data.object as Stripe.Checkout.Session, eventAccount, env);
      break;
    case "checkout.session.expired":
      await handleExpiredSession(event.data.object as Stripe.Checkout.Session, env);
      break;
    case "account.updated":
      await handleAccountUpdated(event.data.object as Stripe.Account, env);
      break;
    default:
      break;
  }
}

export const Route = createFileRoute("/api/public/marketplace/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }

        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (error) {
          console.error("Marketplace webhook error:", error);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
