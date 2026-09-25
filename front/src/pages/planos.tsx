import { Route } from "@/routes/planos";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown, Download, Gauge, Palette, Sparkles } from "lucide-react";
import { useState } from "react";

import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth, usePlus } from "@/lib/auth";
import { isPaymentsConfigured } from "@/lib/stripe";

export function PlansPage() {
  const { user } = useAuth();
  const { data: isPlus = false, isLoading } = usePlus();
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const paymentsReady = isPaymentsConfigured();
  const benefits = [
    { icon: <Sparkles />, title: "Sem anúncios", text: "Leitura contínua e sem interrupções." },
    {
      icon: <Download />,
      title: "Leitura offline",
      text: "Volumes disponíveis mesmo sem internet.",
    },
    {
      icon: <Gauge />,
      title: "Carregamento prioritário",
      text: "Mais páginas preparadas antecipadamente.",
    },
    {
      icon: <Palette />,
      title: "Personalizações exclusivas",
      text: "Temas e controles avançados do leitor.",
    },
  ];
  const plans = [
    {
      name: "Avulso",
      priceId: "mangaka_plus_avulso_30d",
      description: "30 dias de BookSyde Plus, sem renovação automática.",
      price: "25,94",
      originalPrice: "39,90",
      period: "/30 dias",
      total: "Pagamento único, sem renovação automática",
      badge: "35% OFF",
    },
    {
      name: "Mensal",
      priceId: "mangaka_plus_mensal",
      description: "Flexibilidade para cancelar quando quiser.",
      price: "19,44",
      originalPrice: "29,90",
      period: "/mês",
      total: "Cobrado mensalmente",
      badge: "35% OFF",
    },
    {
      name: "Semestral",
      priceId: "mangaka_plus_semestral_180d",
      description: "Seis meses de leitura com uma economia maior.",
      price: "51,94",
      originalPrice: "79,90",
      period: "/6 meses",
      total: "Equivale a R$ 8,66 por mês",
      badge: "35% OFF",
    },
    {
      name: "Anual",
      priceId: "mangaka_plus_anual",
      description: "O menor preço para quem lê o ano inteiro.",
      price: "162,44",
      originalPrice: "249,90",
      period: "/ano",
      total: "Equivale a R$ 13,54 por mês",
      badge: "35% OFF",
      featured: true,
    },
  ];
  return (
    <main className="relative w-full px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-5 sm:py-12 lg:px-8">
      <div className="mb-7 flex justify-end sm:absolute sm:right-4 sm:top-8 sm:mb-0">
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-2 shadow-sm backdrop-blur-md">
          <span
            className={`size-2 rounded-full ${isPlus ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)]" : "bg-muted-foreground/50"}`}
          />
          <span className="text-xs text-muted-foreground">Plano atual</span>
          <strong className="text-xs">
            {isLoading ? "Verificando…" : isPlus ? "BookSyde Plus" : "Gratuito"}
          </strong>
        </div>
      </div>
      <div className="mx-auto max-w-2xl text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Crown />
        </span>
        <p className="mt-5 text-sm font-semibold text-primary">BookSyde Plus</p>
        <h1 className="mt-1 font-display text-3xl leading-tight sm:text-4xl">Leitura no seu ritmo</h1>
        <p className="mt-3 text-muted-foreground">
          Planos para uma experiência mais rápida, personalizada e disponível em qualquer lugar.
        </p>
      </div>

      <section className="mt-10" aria-labelledby="available-plans">
        <div className="text-center">
          <p className="text-sm font-semibold text-primary">Escolha seu acesso</p>
          <h2 id="available-plans" className="mt-1 font-display text-[1.75rem] leading-tight sm:text-4xl">
            Um plano para cada ritmo
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Todos incluem os recursos do BookSyde Plus. Quanto maior o período, menor o valor mensal.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative flex min-h-0 flex-col overflow-hidden rounded-[1.4rem] border p-4 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:min-h-80 sm:rounded-3xl sm:p-6 ${
                plan.featured
                  ? "border-primary bg-gradient-to-br from-primary/[0.14] via-card/90 to-card/75 shadow-xl shadow-primary/15 ring-1 ring-primary/30"
                  : "border-border/70 bg-card/75"
              }`}
            >
              {plan.featured ? (
                <>
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/30 via-primary to-primary/30" />
                  <div className="absolute right-5 top-0 rounded-b-xl bg-primary px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-primary-foreground shadow-md">
                    Melhor custo-benefício
                  </div>
                </>
              ) : null}
              <div
                className={`flex items-start justify-between gap-3 ${plan.featured ? "mt-6" : ""}`}
              >
                <div>
                  <h3 className="font-display text-2xl">{plan.name}</h3>
                  <p className="mt-2 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
                </div>
                <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                  {plan.badge}
                </span>
              </div>

              <div className="mt-6 flex items-end gap-1">
                <span className="pb-1 text-sm font-semibold text-muted-foreground">R$</span>
                <strong className="font-display text-4xl leading-none">{plan.price}</strong>
                <span className="pb-1 text-sm text-muted-foreground">{plan.period}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                De <span className="line-through">R$ {plan.originalPrice}</span>
              </p>
              <p className="mt-1 text-xs font-medium text-foreground/80">{plan.total}</p>

              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {benefits.map((benefit) => (
                  <li key={benefit.title} className="flex items-center gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    {benefit.title}
                  </li>
                ))}
              </ul>

              {user ? (
                <Button
                  className="mt-6 w-full"
                  variant={plan.featured ? "default" : "outline"}
                  disabled={!paymentsReady}
                  onClick={() => setCheckoutPriceId(plan.priceId)}
                >
                  {paymentsReady ? "Assinar agora" : "Disponível em breve"}
                </Button>
              ) : (
                <Button
                  asChild
                  className="mt-6 w-full"
                  variant={plan.featured ? "default" : "outline"}
                >
                  <Link to="/auth">Entrar para assinar</Link>
                </Button>
              )}
            </article>
          ))}
        </div>
        <div className="mt-6">
          <PaymentTestModeBanner />
        </div>
      </section>

      <Dialog
        open={!!checkoutPriceId}
        onOpenChange={(open) => {
          if (!open) setCheckoutPriceId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finalizar assinatura</DialogTitle>
          </DialogHeader>
          {checkoutPriceId ? (
            <StripeEmbeddedCheckout
              priceId={checkoutPriceId}
              {...(user?.email ? { customerEmail: user.email } : {})}
              {...(user?.id ? { userId: user.id } : {})}
              returnUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/planos/retorno?session_id={CHECKOUT_SESSION_ID}`}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
