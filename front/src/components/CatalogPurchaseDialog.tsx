import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStripe } from "@/lib/stripe";
import {
  createCatalogOrder,
  createMarketplaceEmbeddedCheckout,
  formatMarketplacePrice,
} from "@/lib/marketplace";

export function CatalogPurchaseDialog({
  open,
  onOpenChange,
  mangaId,
  title,
  priceCents,
  currency = "BRL",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mangaId: string;
  title: string;
  priceCents: number;
  currency?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    if (!open) {
      requestRef.current = null;
      setError(null);
    }
  }, [open]);

  const fetchClientSecret = useCallback(async () => {
    if (!requestRef.current) {
      requestRef.current = (async () => {
        setError(null);
        const order = await createCatalogOrder(mangaId);
        const checkout = await createMarketplaceEmbeddedCheckout(order.order_id);
        return checkout.clientSecret;
      })().catch((cause) => {
        requestRef.current = null;
        const message = cause instanceof Error ? cause.message : "Não foi possível iniciar a compra.";
        setError(message);
        throw cause;
      });
    }
    return requestRef.current;
  }, [mangaId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94dvh] w-[calc(100%-1rem)] max-w-[760px] overflow-y-auto rounded-[1.5rem] p-0 sm:w-full">
        <DialogHeader className="border-b border-border/60 px-5 py-4 text-left sm:px-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="size-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="line-clamp-1">Comprar {title}</DialogTitle>
              <DialogDescription className="mt-1">
                {formatMarketplacePrice(priceCents, currency)} · pagamento processado com Stripe
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-3 pb-4 pt-3 sm:px-5 sm:pb-5">
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-border/60 bg-muted/35 px-3 py-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Após a confirmação do pagamento, o chat do vendedor recebe a entrega e envia os códigos de ativação deste pedido.
            </span>
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <div className="min-h-[520px] overflow-hidden rounded-xl bg-background">
              <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}

          {!error ? (
            <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> O checkout pode levar alguns segundos para carregar.
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
