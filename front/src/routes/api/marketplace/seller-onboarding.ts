import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import { createSupabaseFetch } from "@/integrations/supabase/api-key-fetch";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";

function parseEnv(request: Request): StripeEnv | null {
  const env = new URL(request.url).searchParams.get("env");
  return env === "sandbox" || env === "live" ? env : null;
}

function sellerColumns(env: StripeEnv) {
  return env === "live"
    ? {
        account: "stripe_live_account_id",
        charges: "live_charges_enabled",
        payouts: "live_payouts_enabled",
        details: "live_details_submitted",
      }
    : {
        account: "stripe_sandbox_account_id",
        charges: "sandbox_charges_enabled",
        payouts: "sandbox_payouts_enabled",
        details: "sandbox_details_submitted",
      };
}

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return { error: Response.json({ error: "Entre na sua conta para ativar recebimentos." }, { status: 401 }) };

  // O login web usa a chave publicável. Valide a sessão no MESMO projeto antes
  // de usar o cliente privilegiado; uma configuração de deploy divergente não
  // deve ser apresentada incorretamente como uma sessão expirada.
  const url = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SECRET_KEY"];
  const missing = [
    !url && "SUPABASE_URL",
    !publishableKey && "SUPABASE_PUBLISHABLE_KEY",
    !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SECRET_KEY",
  ].filter(Boolean);
  if (missing.length) {
    console.error("[seller-onboarding] Configuração privada ausente:", missing.join(", "));
    return {
      error: Response.json(
        { error: `Configuração do servidor incompleta: ${missing.join(", ")}. Configure as variáveis privadas no ambiente publicado e faça um novo deploy.` },
        { status: 503 },
      ),
    };
  }

  const publicUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (publicUrl && publicUrl.replace(/\/+$/, "") !== url!.replace(/\/+$/, "")) {
    console.error("[seller-onboarding] URLs do Supabase divergentes entre web e servidor.");
    return {
      error: Response.json(
        { error: "O site e o servidor estão conectados a projetos Supabase diferentes. Configure SUPABASE_URL com a mesma URL de VITE_SUPABASE_URL e publique novamente." },
        { status: 503 },
      ),
    };
  }

  try {
    const authClient = createClient(url!, publishableKey!, {
      global: { fetch: createSupabaseFetch(publishableKey!) },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) {
      console.warn("[seller-onboarding] Autenticação rejeitada:", error?.status ?? "sem usuário");
      return {
        error: Response.json(
          { error: "A sessão não foi reconhecida pelo Supabase do servidor. Entre novamente. Se persistir, confira se as chaves do site e do servidor são do mesmo projeto." },
          { status: 401 },
        ),
      };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return { user: data.user, supabaseAdmin };
  } catch (error) {
    console.error("[marketplace/seller-onboarding] Falha ao inicializar Supabase no servidor:", error);
    return {
      error: Response.json(
        { error: "Serviço de recebimentos temporariamente indisponível." },
        { status: 503 },
      ),
    };
  }
}

async function isAdminUser(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return !!data;
}

function publicSellerUrl(origin: string, userId: string) {
  // Em produção usamos o domínio atual. Em desenvolvimento, enviamos a URL pública
  // do BookSyde para evitar que a Stripe receba localhost como site do vendedor.
  const baseUrl = /localhost|127\.0\.0\.1/i.test(origin)
    ? "https://booksyde.com.br"
    : origin;

  return `${baseUrl}/marketplace/vendedor/${userId}`;
}

async function createIndividualSellerAccount(
  stripe: Stripe,
  request: Request,
  user: { id: string; email?: string | null },
) {
  const origin = new URL(request.url).origin;

  return stripe.accounts.create({
    country: "BR",
    business_type: "individual",
    ...(user.email ? { email: user.email } : {}),
    business_profile: {
      // 5815 = Digital Goods Media — Books, Movies, Music.
      mcc: "5815",
      product_description:
        "Venda de livros, mangás, HQs e outros conteúdos digitais autorais pelo BookSyde.",
      url: publicSellerUrl(origin, user.id),
    },
    // Direct charges require a payment capability and bank payouts require
    // transfers. Request both so hosted onboarding knows which data to collect.
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      mangaka_user_id: user.id,
      mangakalib_account_type: "individual",
    },
    controller: {
      fees: { payer: "account" },
      losses: { payments: "stripe" },
      requirement_collection: "stripe",
      stripe_dashboard: { type: "full" },
    },
  });
}

async function ensureAdminPlatformSeller(supabaseAdmin: any, userId: string, env: StripeEnv) {
  const values =
    env === "live"
      ? {
          stripe_live_account_id: null,
          live_charges_enabled: true,
          live_payouts_enabled: true,
          live_details_submitted: true,
          updated_at: new Date().toISOString(),
        }
      : {
          stripe_sandbox_account_id: null,
          sandbox_charges_enabled: true,
          sandbox_payouts_enabled: true,
          sandbox_details_submitted: true,
          updated_at: new Date().toISOString(),
        };

  const { error } = await supabaseAdmin.from("marketplace_sellers").upsert(
    {
      user_id: userId,
      ...values,
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);

  return {
    connected: true,
    chargesEnabled: true,
    payoutsEnabled: true,
    detailsSubmitted: true,
    platformAccount: true,
  };
}

async function syncSeller(supabaseAdmin: unknown, userId: string, env: StripeEnv) {
  const db = supabaseAdmin as any;

  // Administradores não precisam de Stripe Connect. Suas vendas são cobradas
  // diretamente pela conta Stripe principal do BookSyde, a mesma dos planos.
  if (await isAdminUser(db, userId)) {
    return ensureAdminPlatformSeller(db, userId, env);
  }

  const columns = sellerColumns(env);
  const { data: seller, error } = await db
    .from("marketplace_sellers")
    .select(
      "user_id,stripe_sandbox_account_id,stripe_live_account_id,sandbox_charges_enabled,sandbox_payouts_enabled,sandbox_details_submitted,live_charges_enabled,live_payouts_enabled,live_details_submitted",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const accountId = seller?.[columns.account] as string | null | undefined;
  if (!accountId) {
    return {
      connected: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      platformAccount: false,
    };
  }

  const stripe = createStripeClient(env);
  const account = await stripe.accounts.retrieve(accountId);
  const status = {
    connected: true,
    chargesEnabled: !!account.charges_enabled,
    payoutsEnabled: !!account.payouts_enabled,
    detailsSubmitted: !!account.details_submitted,
    platformAccount: false,
  };

  const { error: updateError } = await db
    .from("marketplace_sellers")
    .update({
      [columns.charges]: status.chargesEnabled,
      [columns.payouts]: status.payoutsEnabled,
      [columns.details]: status.detailsSubmitted,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateError) throw new Error(updateError.message);
  return status;
}

export const Route = createFileRoute("/api/marketplace/seller-onboarding")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const env = parseEnv(request);
          if (!env) return Response.json({ error: "Ambiente Stripe inválido." }, { status: 400 });

          const auth = await authenticate(request);
          if ("error" in auth) {
            return auth.error;
          }

          const status = await syncSeller(auth.supabaseAdmin, auth.user.id, env);
          return Response.json(status);
        } catch (error) {
          console.error("[marketplace/seller-onboarding] GET indisponível:", error);
          return Response.json(
            { error: "Não foi possível consultar a Stripe. Confira as chaves Stripe e a integração do Supabase no servidor." },
            { status: 503 },
          );
        }
      },

      POST: async ({ request }) => {
        const env = parseEnv(request);
        if (!env) return Response.json({ error: "Ambiente Stripe inválido." }, { status: 400 });

        const auth = await authenticate(request);
        if ("error" in auth) return auth.error;
        const db = auth.supabaseAdmin as any;

        try {
          const adminAccount = await isAdminUser(db, auth.user.id);
          const { data: seller, error: sellerError } = await db
            .from("marketplace_sellers")
            .select("user_id,suspended_at")
            .eq("user_id", auth.user.id)
            .maybeSingle();
          if (sellerError) throw new Error(sellerError.message);
          if (seller?.suspended_at) {
            return Response.json({ error: "Sua loja está suspensa. Entre em contato com o suporte." }, { status: 403 });
          }

          const { data: creatorRole, error: roleError } = adminAccount || seller
            ? { data: null, error: null }
            : await db
                .from("user_roles")
                .select("role")
                .eq("user_id", auth.user.id)
                .eq("role", "creator")
                .limit(1)
                .maybeSingle();
          if (roleError) throw new Error(roleError.message);
          // A conta "Vendedor" é representada por marketplace_sellers. Um usuário
          // que já é vendedor continua apto a concluir a Stripe mesmo que a função
          // de conta tenha sido alterada após o início do cadastro.
          if (!adminAccount && !seller && !creatorRole) {
            return Response.json(
              { error: "É necessário ter uma conta de criador ou vendedor para ativar recebimentos." },
              { status: 403 },
            );
          }

          // Admin: usa a conta principal do BookSyde. Não criamos e nem
          // conectamos uma segunda conta Stripe.
          if (adminAccount) {
            const status = await ensureAdminPlatformSeller(db, auth.user.id, env);
            return Response.json({ status });
          }

          const stripe = createStripeClient(env);
          const columns = sellerColumns(env);
          const { data: current, error: currentError } = await db
            .from("marketplace_sellers")
            .select("stripe_sandbox_account_id,stripe_live_account_id")
            .eq("user_id", auth.user.id)
            .maybeSingle();

          if (currentError) throw new Error(currentError.message);

          let accountId = current?.[columns.account] as string | undefined;

          // Contas antigas podem ter sido iniciadas como empresa. Como o BookSyde
          // aceita vendedores individuais, uma conta ainda incompleta pode ser
          // substituída por uma nova conta individual antes do onboarding.
          if (accountId) {
            const currentStripeAccount = await stripe.accounts.retrieve(accountId);
            const isIndividual = currentStripeAccount.business_type === "individual";
            const alreadyInUse =
              !!currentStripeAccount.details_submitted ||
              !!currentStripeAccount.charges_enabled ||
              !!currentStripeAccount.payouts_enabled;

            if (!isIndividual) {
              if (alreadyInUse && env === "live") {
                return Response.json(
                  {
                    error:
                      "Sua conta de recebimentos atual foi cadastrada como empresa e já está ativa. Entre em contato com o suporte antes de migrá-la para pessoa física.",
                  },
                  { status: 409 },
                );
              }

              accountId = undefined;
            } else if (!currentStripeAccount.capabilities?.card_payments || !currentStripeAccount.capabilities?.transfers) {
              // Contas individuais criadas por versões anteriores não solicitavam
              // explicitamente estas capacidades e podiam ficar pendentes.
              await stripe.accounts.update(accountId, {
                capabilities: {
                  card_payments: { requested: true },
                  transfers: { requested: true },
                },
              });
            }
          }

          if (!accountId) {
            const account = await createIndividualSellerAccount(stripe, request, auth.user);
            accountId = account.id;

            const { error: saveError } = await db.from("marketplace_sellers").upsert(
              {
                user_id: auth.user.id,
                [columns.account]: accountId,
                [columns.charges]: false,
                [columns.payouts]: false,
                [columns.details]: false,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id" },
            );

            if (saveError) throw new Error(saveError.message);
          }

          const origin = new URL(request.url).origin;
          const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${origin}/marketplace/vendedor?connect=refresh`,
            return_url: `${origin}/marketplace/vendedor?connect=return`,
            type: "account_onboarding",
          });

          const status = await syncSeller(auth.supabaseAdmin, auth.user.id, env);
          return Response.json({ url: accountLink.url, status });
        } catch (error) {
          console.error(error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Não foi possível iniciar o cadastro de recebimentos." },
            { status: 400 },
          );
        }
      },
    },
  },
});
