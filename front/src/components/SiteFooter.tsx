import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, HeartHandshake, Scale, Store } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";

const groups = [
  {
    title: "BookSyde",
    links: [
      ["/", "Início"],
      ["/biblioteca", "Biblioteca"],
      ["/marketplace", "Marketplace"],
      ["/compras", "Minhas compras"],
    ],
  },
  {
    title: "Criadores",
    links: [
      ["/studio", "Estúdio"],
      ["/marketplace/vendedor", "Central do vendedor"],
      ["/termos-vendedor", "Termos do vendedor"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["/termos", "Termos de Uso"],
      ["/privacidade", "Privacidade"],
      ["/reembolso", "Reembolsos"],
      ["/direitos-autorais", "Direitos autorais"],
      ["/contato", "Contato"],
    ],
  },
] as const;

export function SiteFooter() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.startsWith("/ler") || pathname === "/auth" || pathname === "/studio") return null;

  return (
    <footer className="mx-auto mt-10 w-full px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-5 lg:px-8 xl:pb-16">
      <div className="overflow-hidden rounded-[1.75rem] border border-border/65 bg-card/65 shadow-[0_24px_65px_-45px_rgba(0,0,0,.95)]">
        <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(280px,1.2fr)_2fr] lg:p-9">
          <div className="max-w-md">
            <BrandLogo
              showName
              tagline="Leitura, biblioteca e marketplace digital."
              imageClassName="size-12"
              nameClassName="text-2xl"
              taglineClassName="text-sm"
            />
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Descubra obras, organize sua biblioteca e compre publicações digitais diretamente de criadores e vendedores autorizados.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5"><BookOpen className="size-3.5" /> Biblioteca</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5"><Store className="size-3.5" /> Marketplace</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5"><HeartHandshake className="size-3.5" /> Criadores</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {groups.map((group) => (
              <div key={group.title}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">{group.title}</p>
                <div className="grid gap-2.5">
                  {group.links.map(([to, label]) => (
                    <Link key={to} to={to} className="w-fit text-sm text-muted-foreground transition hover:text-foreground">
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-border/60 px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-7 lg:px-9">
          <span>© 2026 BookSyde. Todos os direitos reservados.</span>
          <Link to="/direitos-autorais" className="inline-flex items-center gap-1.5 hover:text-foreground"><Scale className="size-3.5" /> Denunciar conteúdo</Link>
        </div>
      </div>
    </footer>
  );
}
