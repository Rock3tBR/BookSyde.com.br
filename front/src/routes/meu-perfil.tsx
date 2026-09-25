// A definição da rota permanece pequena; a tela só carrega quando acessada.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/meu-perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — BookSyde" }] }),
  component: lazyRouteComponent(() => import("@/pages/meu-perfil"), "MyProfilePage"),
});
