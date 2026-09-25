import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen, ChartNoAxesCombined, CircleHelp, FileText, HeartHandshake, LayoutDashboard,
  Menu, ReceiptText, Settings2, ShieldCheck, ShoppingBag, Store, Users, WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type ManagementArea = "admin" | "seller" | "publisher";
type Entry = { label: string; path: string; icon: LucideIcon; exact?: boolean };

const links: Record<ManagementArea, Entry[]> = {
  admin: [
    { label: "Visão geral", path: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Moderação", path: "/admin/moderacao", icon: ShieldCheck },
    { label: "Usuários", path: "/admin/usuarios", icon: Users },
    { label: "Marketplace", path: "/admin/marketplace", icon: Store },
    { label: "Anúncios", path: "/admin/anuncios", icon: BookOpen },
    { label: "Pedidos", path: "/admin/pedidos", icon: ShoppingBag },
    { label: "Suporte", path: "/admin/suporte", icon: CircleHelp },
    { label: "Denúncias", path: "/admin/denuncias", icon: ShieldCheck },
    { label: "Reembolsos", path: "/admin/reembolsos", icon: ReceiptText },
    { label: "Assinaturas", path: "/admin/assinaturas", icon: FileText },
    { label: "Financeiro", path: "/admin/financeiro", icon: WalletCards },
    { label: "Contratos", path: "/admin/contratos", icon: FileText },
    { label: "Doações", path: "/admin/doacoes", icon: HeartHandshake },
  ],
  seller: [
    { label: "Visão geral", path: "/vendedor", icon: LayoutDashboard, exact: true },
    { label: "Pedidos", path: "/vendedor/pedidos", icon: ShoppingBag },
    { label: "Publicações", path: "/vendedor/publicacoes", icon: BookOpen },
    { label: "Financeiro", path: "/vendedor/financeiro", icon: WalletCards },
    { label: "Minha loja", path: "/vendedor/loja", icon: Settings2 },
  ],
  publisher: [
    { label: "Visão geral", path: "/editora", icon: LayoutDashboard, exact: true },
    { label: "Meu catálogo", path: "/editora/catalogo", icon: BookOpen },
    { label: "Contratos", path: "/editora/contratos", icon: FileText },
    { label: "Financeiro", path: "/editora/financeiro", icon: WalletCards },
    { label: "Relatórios", path: "/editora/relatorios", icon: ChartNoAxesCombined },
    { label: "Configurações", path: "/editora/configuracoes", icon: ReceiptText },
  ],
};
const titles = { admin: "Administração", seller: "Minha loja", publisher: "Gestão editorial" };

export function ManagementNavigation({ area, children }: { area: ManagementArea; children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);
  const items = links[area];
  const current = items.find((item) => pathname === item.path) ?? items[0]!;
  const groupLabels: Record<ManagementArea, Record<string, string>> = {
    admin: { "/admin/dashboard": "Visão", "/admin/moderacao": "Conteúdo e pessoas", "/admin/marketplace": "Operação comercial", "/admin/assinaturas": "Receita e pagamentos", "/admin/doacoes": "Configurações" },
    seller: { "/vendedor": "Visão", "/vendedor/pedidos": "Operação da loja", "/vendedor/financeiro": "Resultados", "/vendedor/loja": "Configurações" },
    publisher: { "/editora": "Visão", "/editora/catalogo": "Catálogo e direitos", "/editora/financeiro": "Resultados", "/editora/configuracoes": "Configurações" },
  };
  const nav = (mobile: boolean) => items.map((item) => {
    const Icon = item.icon;
    const active = item.exact ? pathname === item.path : pathname === item.path || pathname.startsWith(item.path + "/");
    const entry = (
      <Link
        to={item.path as never}
        onClick={() => mobile && setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary", active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
      >
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">{item.label}</span>
      </Link>
    );
    return <div key={item.path}>
      {groupLabels[area][item.path] ? <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/75 first:pt-1">{groupLabels[area][item.path]}</p> : null}
      {mobile ? <SheetClose asChild>{entry}</SheetClose> : entry}
    </div>;
  });

  return (
    <div className="grid w-full min-w-0 gap-5 px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-7 lg:px-7 lg:py-7">
      <aside className="hidden self-start rounded-2xl border border-border/70 bg-card/65 p-3 lg:sticky lg:top-28 lg:block" aria-label={`Menu: ${titles[area]}`}>
        <p className="px-3 pb-3 pt-2 text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground">{titles[area]}</p>
        <nav className="space-y-1">{nav(false)}</nav>
      </aside>
      <div className="min-w-0">
        <div className="mb-4 flex min-w-0 items-center gap-3 rounded-xl border border-border/65 bg-card/70 px-3 py-2 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild><Button variant="outline" size="sm" aria-label={`Abrir menu de ${titles[area]}`} className="shrink-0 rounded-lg"><Menu className="size-4"/> Menu</Button></SheetTrigger>
            <SheetContent side="left" className="w-[min(88vw,320px)] overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
              <SheetHeader className="pb-4 pt-5 text-left"><SheetTitle>{titles[area]}</SheetTitle><SheetDescription>Escolha uma área para gerenciar.</SheetDescription></SheetHeader>
              <nav className="space-y-1" aria-label={`Menu: ${titles[area]}`}>{nav(true)}</nav>
            </SheetContent>
          </Sheet>
          <span className="min-w-0 truncate text-sm font-semibold">{current.label}</span>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
