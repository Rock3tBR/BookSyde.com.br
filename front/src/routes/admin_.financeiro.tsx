import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/admin_/financeiro")({ head: () => ({ meta: [{ title: "Financeiro — BookSyde" }] }), component: lazyRouteComponent(() => import("@/components/AdminFinance"), "AdminFinance") });
