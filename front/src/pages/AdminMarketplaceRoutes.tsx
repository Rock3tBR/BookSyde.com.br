import { AdminMarketView } from "@/components/AdminMarketView";

export function AdminMarketVendorsPage() {
  return <AdminMarketView section="vendedores" />;
}

export function AdminMarketListingsPage() {
  return <AdminMarketView section="anuncios" />;
}

export function AdminMarketOrdersPage() {
  return <AdminMarketView section="pedidos" />;
}

export function AdminMarketReportsPage() {
  return <AdminMarketView section="denuncias" />;
}

export function AdminMarketRefundsPage() {
  return <AdminMarketView section="reembolsos" />;
}

export function AdminMarketSupportPage() {
  return <AdminMarketView section="suporte" />;
}
