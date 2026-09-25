import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

async function getAccessToken(refresh = false): Promise<string> {
  if (refresh) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session?.access_token) {
      throw new Error("Sua sessão expirou. Entre novamente para continuar.");
    }
    return data.session.access_token;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Você precisa estar autenticado.");
  return token;
}

async function authorizedFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const request = (token: string) => fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  let response = await request(await getAccessToken());
  // Um token antigo pode permanecer no armazenamento após mudar de domínio ou
  // publicar uma nova versão. Revalide uma única vez; nunca repita erros 403/5xx.
  if (response.status === 401) response = await request(await getAccessToken(true));

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Não foi possível concluir a operação.");
  }
  return payload;
}

export type MarketplaceSellerStatus = {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  /**
   * Quando true, as vendas usam diretamente a conta Stripe principal
   * do BookSyde (a mesma usada nos planos), sem Stripe Connect.
   */
  platformAccount?: boolean;
  unavailable?: boolean;
  error?: string;
};

export async function startMarketplaceSellerOnboarding(): Promise<{
  url?: string;
  status: MarketplaceSellerStatus;
}> {
  const environment = getStripeEnvironment();
  return authorizedFetch(`/api/marketplace/seller-onboarding?env=${environment}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function syncMarketplaceSellerStatus(): Promise<MarketplaceSellerStatus> {
  const environment = getStripeEnvironment();
  try {
    return await authorizedFetch(`/api/marketplace/seller-onboarding?env=${environment}`, { method: "GET" });
  } catch (error) {
    // O Marketplace deve continuar utilizável mesmo quando Stripe Connect/Supabase
    // server-side estiver temporariamente indisponível no preview.
    console.warn("[marketplace] Status do vendedor indisponível:", error);
    return {
      connected: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      platformAccount: false,
      unavailable: true,
      error: error instanceof Error ? error.message : "Não foi possível consultar os recebimentos.",
    };
  }
}

export async function createMarketplaceCheckout(orderId: string): Promise<{ url: string }> {
  const environment = getStripeEnvironment();
  return authorizedFetch(`/api/marketplace/checkout?env=${environment}`, {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });
}


export type MarketplaceOrderCreateResult = {
  order_id: string;
  seller_id: string;
  total_cents: number;
  stripe_environment: "sandbox" | "live";
  uses_platform_stripe?: boolean;
};

export async function createMarketplaceOrder(
  listingIds: string[],
): Promise<MarketplaceOrderCreateResult> {
  const environment = getStripeEnvironment();
  return authorizedFetch<MarketplaceOrderCreateResult>("/api/marketplace/order", {
    method: "POST",
    body: JSON.stringify({ listingIds, environment }),
  });
}


export async function createCatalogOrder(
  mangaId: string,
): Promise<MarketplaceOrderCreateResult> {
  const environment = getStripeEnvironment();
  return authorizedFetch<MarketplaceOrderCreateResult>("/api/marketplace/order", {
    method: "POST",
    body: JSON.stringify({ mangaId, environment, source: "catalog" }),
  });
}

export async function createMarketplaceEmbeddedCheckout(
  orderId: string,
): Promise<{ clientSecret: string }> {
  const environment = getStripeEnvironment();
  return authorizedFetch(`/api/marketplace/checkout?env=${environment}`, {
    method: "POST",
    body: JSON.stringify({ orderId, uiMode: "embedded" }),
  });
}

export function formatMarketplacePrice(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
