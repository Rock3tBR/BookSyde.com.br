import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, ExternalLink, Loader2, PackageCheck, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { PublicationCover } from "@/components/PublicationCover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createMarketplaceCheckout, formatMarketplacePrice } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

type DbError = { message: string };
type RpcResult = { data: unknown; error: DbError | null };

const marketplaceDb = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
};

type OrderItem = {
  id: string;
  title: string;
  target_type: "manga" | "folder";
  price_cents: number;
  cover_url: string | null;
  work_type?: string;
};

type DeliveryCode = {
  code: string;
  title: string;
  target_type: "manga" | "folder";
  used_at: string | null;
};

type OrderDetails = {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: "pending" | "awaiting_payment" | "paid" | "expired" | "canceled" | "refunded";
  total_cents: number;
  currency: string;
  checkout_url: string | null;
  paid_at: string | null;
  items: OrderItem[];
  codes: DeliveryCode[];
};

export function MarketplaceOrderMessage({
  orderId,
  currentUserId,
  compact = false,
}: {
  orderId: string;
  currentUserId: string;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["marketplace-order", orderId, currentUserId],
    queryFn: async () => {
      const { data, error } = await marketplaceDb.rpc("get_marketplace_order_details", {
        _order_id: orderId,
      });
      if (error) throw error;
      const order = data as OrderDetails;
      if (order.items.some((item) => !item.work_type)) {
        const { data: types } = await supabase.from("marketplace_order_items")
          .select("id,work_type").eq("order_id", orderId);
        const byId = new Map((types ?? []).map((item) => [item.id, item.work_type]));
        order.items = order.items.map((item) => ({ ...item, work_type: item.work_type ?? byId.get(item.id) ?? "manga" }));
      }
      return order;
    },
    refetchInterval: (query) => {
      const current = query.state.data as OrderDetails | undefined;
      return current?.status === "paid" ? false : 5_000;
    },
  });

  const openCheckout = useMutation({
    mutationFn: async () => createMarketplaceCheckout(orderId),
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível abrir o pagamento."),
  });

  const redeemCode = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await marketplaceDb.rpc("redeem_marketplace_code", { _code: code });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketplace-order", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["library-workspace"] });
      void queryClient.invalidateQueries({ queryKey: ["personal-library"] });
      toast.success("Arquivo importado para sua biblioteca.");
    },
    onError: (error: DbError) => toast.error(error.message || "Não foi possível importar o código."),
  });

  const redeemAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await marketplaceDb.rpc("redeem_marketplace_order", {
        _order_id: orderId,
      });
      if (error) throw error;
      return data as { codes?: number; files?: number };
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["marketplace-order", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["library-workspace"] });
      void queryClient.invalidateQueries({ queryKey: ["personal-library"] });
      toast.success(
        data.files
          ? `${data.files} arquivo${data.files === 1 ? "" : "s"} importado${data.files === 1 ? "" : "s"}.`
          : "Todos os arquivos disponíveis já foram importados.",
      );
    },
    onError: (error: DbError) => toast.error(error.message || "Não foi possível importar o pedido."),
  });

  if (isLoading || !order) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/50 bg-background/45 px-3 py-2 text-xs">
        <Loader2 className="size-3.5 animate-spin" /> Carregando pedido…
      </div>
    );
  }

  const isBuyer = order.buyer_id === currentUserId;
  const unusedCodes = order.codes.filter((code) => !code.used_at);
  const paid = order.status === "paid";

  return (
    <div
      className={cn(
        "mt-3 overflow-hidden rounded-2xl border border-border/60 bg-background/85 text-foreground shadow-sm",
        compact ? "min-w-[260px]" : "min-w-[280px] sm:min-w-[340px]",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3.5 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Pedido
          </p>
          <p className="mt-0.5 text-sm font-semibold">{formatMarketplacePrice(order.total_cents, order.currency)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="space-y-2 p-3.5">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-xl bg-muted/45 px-3 py-2">
            <PublicationCover
              coverUrl={item.cover_url} workType={item.work_type}
              title={item.title}
              className="h-11 w-8 rounded object-cover"
              fallback={
                <div className="grid h-11 w-8 place-items-center rounded bg-background/80">
                  <PackageCheck className="size-4 text-muted-foreground" />
                </div>
              }
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{item.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {item.target_type === "folder" ? "Pasta" : "Arquivo"} · {formatMarketplacePrice(item.price_cents)}
              </p>
            </div>
          </div>
        ))}

        {isBuyer && !paid ? (
          <Button
            type="button"
            className="mt-2 w-full"
            disabled={openCheckout.isPending}
            onClick={() => openCheckout.mutate()}
          >
            {openCheckout.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <WalletCards className="size-4" />
            )}
            {openCheckout.isPending ? "Gerando pagamento…" : "Pagar com Stripe"}
          </Button>
        ) : null}

        {paid && isBuyer && order.codes.length ? (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="size-4 text-emerald-500" /> Pagamento confirmado
            </div>
            {order.codes.map((delivery) => (
              <div key={delivery.code} className="rounded-xl border border-border/60 p-3">
                <p className="truncate text-xs font-semibold">{delivery.title}</p>
                <p className="mt-1 select-all font-sans text-[11px] text-muted-foreground">
                  {delivery.code}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 h-8 w-full"
                  disabled={!!delivery.used_at || redeemCode.isPending}
                  onClick={() => redeemCode.mutate(delivery.code)}
                >
                  <Download className="size-3.5" />
                  {delivery.used_at ? "Já importado" : "Importar este item"}
                </Button>
              </div>
            ))}
            <Button
              type="button"
              className="w-full"
              disabled={!unusedCodes.length || redeemAll.isPending}
              onClick={() => redeemAll.mutate()}
            >
              {redeemAll.isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {unusedCodes.length ? `Importar todos (${unusedCodes.length})` : "Tudo importado"}
            </Button>
          </div>
        ) : null}

        {!isBuyer && paid ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" /> Pagamento confirmado e entrega gerada.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderDetails["status"] }) {
  const label =
    status === "paid"
      ? "Pago"
      : status === "awaiting_payment"
        ? "Aguardando pagamento"
        : status === "expired"
          ? "Link expirado"
          : status === "refunded"
            ? "Reembolsado"
            : status === "canceled"
              ? "Cancelado"
              : "Pedido criado";

  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
        status === "paid"
          ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
          : "bg-primary/10 text-primary",
      )}
    >
      {label}
    </span>
  );
}
