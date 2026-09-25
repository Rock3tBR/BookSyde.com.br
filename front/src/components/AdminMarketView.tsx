import { MarketplaceAdminPanel, type MarketplaceAdminSection } from "@/components/MarketplaceAdminPanel";
import { ManagementNavigation } from "@/components/ManagementNavigation";
import { useIsAdmin, useAuth } from "@/lib/auth";

const names: Record<MarketplaceAdminSection, string> = {
  vendedores: "Vendedores", anuncios: "Anúncios", pedidos: "Pedidos", denuncias: "Denúncias", reembolsos: "Reembolsos", suporte: "Suporte",
};
export function AdminMarketView({ section }: { section: MarketplaceAdminSection }) {
  const { user, loading } = useAuth();
  const { data: admin, isLoading } = useIsAdmin();
  if (loading || isLoading) return <main className="p-8 text-sm text-muted-foreground">Verificando acesso…</main>;
  if (!user || !admin) return <main className="p-8 text-sm text-muted-foreground">Área exclusiva da administração.</main>;
  return <ManagementNavigation area="admin">
    <div className="mb-5"><p className="text-sm font-medium text-primary">Operação</p><h1 className="font-display text-2xl sm:text-3xl">{names[section]}</h1></div>
    <MarketplaceAdminPanel section={section}/>
  </ManagementNavigation>;
}
