import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/planos/retorno")({
  head: () => ({
    meta: [
      { title: "Assinatura confirmada — BookSyde" },
      {
        name: "description",
        content: "Confirmação da contratação do BookSyde Plus e liberação da leitura completa.",
      },
      { property: "og:title", content: "Assinatura confirmada — BookSyde" },
      {
        property: "og:description",
        content: "Confirmação da contratação do BookSyde Plus e liberação da leitura completa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { session_id?: string } =>
    typeof search["session_id"] === "string" ? { session_id: search["session_id"] } : {},
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <CheckCircle2 />
      </span>
      <h1 className="mt-6 font-display text-3xl">
        {sessionId ? "Pagamento concluído" : "Pagamento não identificado"}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {sessionId
          ? "Seu acesso ao BookSyde Plus é liberado em alguns instantes. Se ainda aparecer como gratuito, atualize a página."
          : "Não encontramos os dados desta compra. Se você concluiu o pagamento, aguarde alguns instantes e recarregue."}
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link to="/">Ir para o catálogo</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/planos">Ver planos</Link>
        </Button>
      </div>
    </main>
  );
}
