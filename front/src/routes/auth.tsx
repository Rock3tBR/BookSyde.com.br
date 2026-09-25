// A definição da rota permanece pequena; a tela só carrega quando acessada.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — BookSyde" },
      { name: "description", content: "Entre ou crie sua conta para ler e comprar mangás." },
      { property: "og:title", content: "Entrar — BookSyde" },
      { property: "og:description", content: "Acesse sua estante de mangás." },
    ],
  }),
  component: lazyRouteComponent(() => import("@/pages/auth"), "AuthPage"),
});
