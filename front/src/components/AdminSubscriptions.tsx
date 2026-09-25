import { useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { ManagementNavigation } from "@/components/ManagementNavigation";
import { ManagementNotice } from "@/components/ManagementNotice";
import { useAuth, useIsAdmin } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export function AdminSubscriptions() {
  const { user, loading } = useAuth();
  const { data: admin, isLoading } = useIsAdmin();
  const query = useQuery({
    queryKey: ["admin-subscription-summary"],
    enabled: !!user && !!admin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_dashboard", { _days: 30 });
      if (error) throw error;
      const users = (data as unknown as { users?: { plus?: number; total?: number } })?.users;
      if (!users || typeof users.plus !== "number") throw new Error("Indicador Plus indisponível");
      return users;
    },
  });
  if (loading || isLoading) return <main className="p-8 text-sm text-muted-foreground">Verificando acesso…</main>;
  if (!user || !admin) return <main className="p-8 text-sm text-muted-foreground">Área exclusiva da administração.</main>;
  return <ManagementNavigation area="admin"><div className="space-y-5">
    <div><p className="text-sm font-medium text-primary">Receita recorrente</p><h1 className="font-display text-3xl">Assinaturas</h1><p className="mt-1 text-sm text-muted-foreground">Visão de acesso Plus existente; cobrança e MRR requerem conciliação Stripe.</p></div>
    {query.isSuccess ? <div className="rounded-2xl border border-border/70 bg-card/70 p-5 sm:p-7"><Crown className="size-6 text-primary"/><p className="mt-4 text-sm text-muted-foreground">Contas com acesso Plus segundo o dashboard</p><p className="mt-1 font-display text-3xl">{query.data.plus.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-muted-foreground">Não equivale necessariamente a assinaturas pagas ativas. Contas totais: {query.data.total?.toLocaleString("pt-BR") ?? "indisponível"}.</p></div> : null}
    {query.isLoading ? <p className="text-sm text-muted-foreground">Consultando indicador Plus…</p> : null}
    {query.isError ? <ManagementNotice title="Indicador não disponível" description="A consulta ao dashboard administrativo falhou. Não exibiremos quantidades fictícias."/> : null}
    <ManagementNotice title="Cobranças, renovações e receita recorrente" description="Ainda é necessário integrar eventos verificados da Stripe, faturas, reembolsos e assinaturas por ambiente. Sem esses dados não é possível mostrar MRR, inadimplência, churn, saldo ou lucro. O catálogo Plus licenciado também dependerá de contratos válidos por obra."/>
  </div></ManagementNavigation>;
}
