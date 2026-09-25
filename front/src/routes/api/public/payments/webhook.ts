import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return _supabase;
}

// Duração dos planos pagos sem renovação automática.
const ONE_TIME_PLAN_DAYS: Record<string, number> = {
  mangaka_plus_avulso_30d: 30,
  mangaka_plus_semestral_180d: 180,
};

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function resolvePlanCode(price: any): string {
  return price?.lookup_key || price?.metadata?.lovable_external_id || price?.id || "desconhecido";
}

async function upsertSubscription(row: Record<string, unknown>) {
  await getSupabase()
    .from("subscriptions")
    .upsert(row as never, { onConflict: "provider,provider_ref" });
}

async function handleSubscriptionEvent(subscription: any, env: StripeEnv, canceled = false) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("Assinatura sem userId nos metadados");
    return;
  }
  const item = subscription.items?.data?.[0];
  const planCode = resolvePlanCode(item?.price);
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await upsertSubscription({
    user_id: userId,
    plan_code: planCode,
    price_id: planCode,
    status: canceled ? "canceled" : subscription.status,
    current_period_end: isoFromUnix(periodEnd),
    provider: "stripe",
    provider_ref: subscription.id,
    stripe_customer_id:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
    environment: env,
    updated_at: new Date().toISOString(),
  });
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  if (session.mode !== "payment") return;
  const userId = session.metadata?.userId;
  const planCode = session.metadata?.priceId;
  if (!userId || !planCode) return;

  const days = ONE_TIME_PLAN_DAYS[planCode] ?? 30;
  const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  await upsertSubscription({
    user_id: userId,
    plan_code: planCode,
    price_id: planCode,
    status: "active",
    current_period_end: end,
    provider: "stripe",
    provider_ref: session.id,
    stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
    environment: env,
    updated_at: new Date().toISOString(),
  });
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionEvent(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionEvent(event.data.object, env, true);
      break;
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status !== "unpaid") await handleCheckoutCompleted(session, env);
      break;
    }
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutCompleted(event.data.object, env);
      break;
    default:
      console.log("Evento não tratado:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook com env inválido:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
