import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin_/assinaturas")({ head: () => ({ meta: [{ title: "Assinaturas — BookSyde" }] }), component: lazyRouteComponent(() => import("@/components/AdminSubscriptions"), "AdminSubscriptions") });
