import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Crown,
  Heart,
  Home,
  LayoutDashboard,
  Library,
  LibraryBig,
  LogOut,
  Menu,
  Palette,
  Search,
  Sparkles,
  Store,
  User,
  WalletCards,
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { useAccessRole, useAuth, useProfile } from "@/lib/auth";
import { getAccessRoleLabel } from "@/lib/access";
import type { WorkType } from "@/lib/publication";
import { cn } from "@/lib/utils";

function isWorkType(value: unknown): value is WorkType {
  return value === "manga" || value === "hq" || value === "book" || value === "gibi";
}

type HeaderNavItem = {
  key: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
  showMarketplaceBadge?: boolean;
};

export function SiteHeader() {
  const { user } = useAuth();
  const { role, isLoading: loadingRole } = useAccessRole();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useRouterState({ select: (state) => state.location });
  const pathname = location.pathname;
  const routeSearch = (location.search ?? {}) as Record<string, unknown>;

  const studioActive = pathname === "/studio";
  const dashboardActive = pathname === "/dashboard" || pathname === "/admin/dashboard";
  const adminActive = pathname === "/admin" || pathname.startsWith("/admin/");
  const publisherActive = pathname === "/editora" || pathname.startsWith("/editora/");
  const libraryActive = pathname === "/biblioteca" && routeSearch["tab"] !== "favorites";
  const favoritesActive = pathname === "/biblioteca" && routeSearch["tab"] === "favorites";
  const physicalShelfActive = pathname === "/estante-fisica";
  const plansActive = pathname === "/planos" || pathname.startsWith("/planos/");
  const sellerAreaActive = pathname === "/marketplace/vendedor" || pathname === "/vendedor" || pathname.startsWith("/vendedor/");
  const marketplaceActive =
    (pathname === "/marketplace" || pathname.startsWith("/marketplace/")) && !sellerAreaActive;
  const personalizationActive = pathname === "/conta";

  const activeType =
    pathname === "/" && isWorkType(routeSearch["type"]) ? routeSearch["type"] : null;
  const currentQuery =
    pathname === "/" && typeof routeSearch["q"] === "string" ? routeSearch["q"] : "";
  const [headerSearch, setHeaderSearch] = useState(currentQuery);
  const [hasNewMarketplaceItems, setHasNewMarketplaceItems] = useState(false);

  const canSeeMarketplace = !user || role !== "editora";

  const { data: latestMarketplacePublication } = useQuery({
    queryKey: ["marketplace-latest-publication"],
    enabled: canSeeMarketplace,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("created_at")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.created_at ?? null;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!latestMarketplacePublication) return;
    const storageKey = "mangaka-marketplace-last-seen";
    const lastSeen = window.localStorage.getItem(storageKey);

    if (!lastSeen) {
      window.localStorage.setItem(storageKey, latestMarketplacePublication);
      setHasNewMarketplaceItems(false);
      return;
    }

    if (marketplaceActive) {
      window.localStorage.setItem(storageKey, latestMarketplacePublication);
      setHasNewMarketplaceItems(false);
      return;
    }

    setHasNewMarketplaceItems(
      new Date(latestMarketplacePublication).getTime() > new Date(lastSeen).getTime(),
    );
  }, [latestMarketplacePublication, marketplaceActive]);

  useEffect(() => {
    setHeaderSearch(currentQuery);
  }, [currentQuery]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function goHome() {
    setHeaderSearch("");
    void navigate({ to: "/", search: {}, hash: "" });
  }

  function goMarketplace() {
    void navigate({
      to: "/marketplace",
      search: { seller: "", connect: "", similarTo: "" },
    });
  }

  function goStudio() {
    void navigate({ to: "/studio", search: { obra: "", aba: "obras" } });
  }

  function goDashboard() {
    void navigate({ to: role === "admin" ? "/admin/dashboard" : "/dashboard" });
  }

  function goLibrary() {
    void navigate({ to: "/biblioteca", search: { tab: "all" } });
  }

  function goPhysicalShelf() {
    if (!user) { void navigate({ to: "/auth" }); return; }
    void navigate({ to: "/estante-fisica" });
  }

  function goToFavorites() {
    if (!user) {
      void navigate({ to: "/auth" });
      return;
    }
    void navigate({ to: "/biblioteca", search: { tab: "favorites" } });
  }

  function goPlans() {
    void navigate({ to: "/planos" });
  }

  function goProfile() {
    void navigate({ to: "/meu-perfil" });
  }

  function goPersonalization() {
    if (!user) {
      void navigate({ to: "/auth" });
      return;
    }
    void navigate({ to: "/conta", search: { tab: "reading" } });
  }

  function goAdmin() {
    void navigate({ to: "/admin/dashboard" });
  }

  function goPublisher() {
    void navigate({ to: "/editora" });
  }

  function goSellerArea() {
    void navigate({ to: "/vendedor" });
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = headerSearch.trim();

    void navigate({
      to: "/",
      search: {
        ...(q ? { q } : {}),
        ...(activeType ? { type: activeType } : {}),
      },
      hash: "catalogo",
    });
  }

  const navItems: HeaderNavItem[] = (() => {
    const home: HeaderNavItem = {
      key: "home",
      label: "Home",
      icon: <Home className="size-[18px]" />,
      active: pathname === "/",
      onClick: goHome,
    };
    const marketplace: HeaderNavItem = {
      key: "marketplace",
      label: "Marketplace",
      icon: <Store className="size-[18px]" />,
      active: marketplaceActive,
      onClick: goMarketplace,
      showMarketplaceBadge: hasNewMarketplaceItems && !marketplaceActive,
    };
    const studio: HeaderNavItem = {
      key: "studio",
      label: "Estúdio",
      icon: <Sparkles className="size-[18px]" />,
      active: studioActive,
      onClick: goStudio,
    };
    const dashboard: HeaderNavItem = {
      key: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="size-[18px]" />,
      active: dashboardActive,
      onClick: goDashboard,
    };
    const library: HeaderNavItem = {
      key: "library",
      label: "Biblioteca",
      icon: <Library className="size-[18px]" />,
      active: libraryActive,
      onClick: goLibrary,
    };
    const physicalShelf: HeaderNavItem = {
      key: "physical-shelf",
      label: "Estante física",
      icon: <LibraryBig className="size-[18px]" />,
      active: physicalShelfActive,
      onClick: goPhysicalShelf,
    };
    const favorites: HeaderNavItem = {
      key: "favorites",
      label: "Favoritos",
      icon: <Heart className={cn("size-[18px]", favoritesActive && "fill-current")} />,
      active: favoritesActive,
      onClick: goToFavorites,
    };
    const plans: HeaderNavItem = {
      key: "plans",
      label: "Planos",
      icon: <Crown className="size-[18px]" />,
      active: plansActive,
      onClick: goPlans,
    };
    const personalization: HeaderNavItem = {
      key: "personalization",
      label: "Personalização",
      icon: <Palette className="size-[18px]" />,
      active: personalizationActive,
      onClick: goPersonalization,
    };
    const seller: HeaderNavItem = {
      key: "seller",
      label: "Minha loja",
      icon: <WalletCards className="size-[18px]" />,
      active: sellerAreaActive,
      onClick: goSellerArea,
    };
    const admin: HeaderNavItem = {
      key: "admin",
      label: "Dashboard",
      icon: <LayoutDashboard className="size-[18px]" />,
      active: adminActive,
      onClick: goAdmin,
    };

    const publisher: HeaderNavItem = {
      key: "publisher",
      label: "Gestão editorial",
      icon: <BookOpen className="size-[18px]" />,
      active: publisherActive,
      onClick: goPublisher,
    };

    // Visitantes mantêm apenas os caminhos públicos essenciais.
    if (!user) return [home, marketplace, plans];
    if (loadingRole || !role) return [home];

    switch (role) {
      case "admin":
        return [home, marketplace, studio, library, physicalShelf, admin];
      case "editora":
        return [home, dashboard, studio, library, physicalShelf, publisher];
      case "seller":
        return [home, marketplace, studio, library, physicalShelf, seller, plans, personalization];
      case "creator":
        return [home, marketplace, studio, library, physicalShelf, favorites, plans, personalization];
      default:
        // Mapa Literário é permitido para clientes, mas permanece invisível no
        // header por enquanto, conforme solicitado.
        return [home, marketplace, library, physicalShelf, favorites, plans, personalization];
    }
  })();

  if (pathname.startsWith("/ler") || pathname === "/auth") return null;

  const roleLabel = role ? getAccessRoleLabel(role) : "Conta";
  const mobilePrimaryOrder = ["home", "admin", "dashboard", "publisher", "seller", "studio", "physical-shelf"];
  const mobilePrimaryItems = navItems
    .filter((item) => mobilePrimaryOrder.includes(item.key))
    .sort((a, b) => mobilePrimaryOrder.indexOf(a.key) - mobilePrimaryOrder.indexOf(b.key));

  return (
    <header className="sticky top-0 z-40 bg-transparent pt-[env(safe-area-inset-top)]">
      <div
        data-tour="main-navigation"
        className="site-header-shell mx-2 my-2 flex min-h-14 items-center gap-2 rounded-[12px] border border-border/45 bg-card/90 px-2.5 py-2 shadow-[0_20px_60px_-40px_rgba(0,0,0,.9)] backdrop-blur-2xl supports-[backdrop-filter]:bg-card/78 sm:mx-4 sm:min-h-[72px] sm:gap-3 sm:px-4 lg:mx-6 lg:my-3 lg:px-5 xl:mx-8 xl:px-6 2xl:mx-10"
      >
        {/* Mobile: logo compacta + busca */}
        <div className="flex min-w-0 flex-1 items-center gap-2 xl:hidden">
          <Link to="/" className="hidden shrink-0 min-[360px]:block" aria-label="Ir para a home">
            <BrandLogo compact imageClassName="sm:size-10" />
          </Link>
          <HeaderSearch
            value={headerSearch}
            onChange={setHeaderSearch}
            onSubmit={handleSearch}
            compact
          />
        </div>

        {/* Desktop: a navegação muda conforme o tipo da conta. */}
        <div className="hidden min-w-0 flex-1 items-center gap-4 xl:flex">
          <HeaderSearch value={headerSearch} onChange={setHeaderSearch} onSubmit={handleSearch} />

          <nav
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5"
            aria-label="Navegação principal"
          >
            {navItems.map((item) => (
              <DesktopNavItem key={item.key} item={item} />
            ))}
          </nav>
        </div>

        {/* Conta */}
        <div className="hidden shrink-0 items-center xl:flex">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-2.5 rounded-full border border-transparent bg-transparent py-1.5 pl-1.5 pr-2.5 text-left transition hover:bg-background/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label="Abrir menu da conta"
                >
                  <Avatar className="size-9 rounded-full border border-white/10">
                    <AvatarImage src={profile?.avatar_url ?? undefined} className="object-cover" />
                    <AvatarFallback>
                      <User className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden min-w-0 max-w-[155px] lg:block">
                    <p className="truncate text-sm font-semibold">
                      {profile?.display_name ?? user.email}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{roleLabel}</p>
                  </div>
                  <Menu className="size-[18px] shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2">
                <DropdownMenuLabel className="px-3 py-2">
                  <p className="truncate text-sm font-semibold">
                    {profile?.display_name ?? user.email}
                  </p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {user.email} · {roleLabel}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer rounded-xl px-3 py-2" onSelect={goProfile}>
                  <User className="size-4" /> Meu perfil
                </DropdownMenuItem>
                {role === "admin" ? (
                  <DropdownMenuItem className="cursor-pointer rounded-xl px-3 py-2" onSelect={goSellerArea}>
                    <Store className="size-4" /> Minha loja
                  </DropdownMenuItem>
                ) : null}
                {role !== "editora" ? (
                  <>
                    <DropdownMenuItem className="cursor-pointer rounded-xl px-3 py-2" onSelect={goToFavorites}>
                      <Heart className="size-4" /> Favoritos
                    </DropdownMenuItem>
                    {role !== "admin" ? (
                      <DropdownMenuItem className="cursor-pointer rounded-xl px-3 py-2" onSelect={goPlans}>
                        <Crown className="size-4" /> Planos
                      </DropdownMenuItem>
                    ) : null}
                  </>
                ) : null}
                <DropdownMenuItem
                  className="cursor-pointer rounded-xl px-3 py-2"
                  onSelect={(event) => {
                    event.preventDefault();
                    goPersonalization();
                  }}
                >
                  <Palette className="size-4" /> Personalização
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer rounded-xl px-3 py-2 text-destructive focus:text-destructive"
                  onSelect={(event) => {
                    event.preventDefault();
                    void handleSignOut();
                  }}
                >
                  <LogOut className="size-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild className="rounded-full px-5">
              <Link to="/auth">Entrar</Link>
            </Button>
          )}
        </div>

        {/* Menu mobile */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 rounded-full xl:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[min(92vw,24rem)] max-w-sm overflow-y-auto border-l border-border/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:p-5">
            <SheetHeader className="text-left">
              <div className="flex items-center gap-3">
                <BrandLogo
                  showName
                  tagline="Biblioteca digital de mangás e histórias visuais."
                  nameClassName="text-2xl"
                />
                <SheetTitle className="sr-only">BookSyde</SheetTitle>
                <SheetDescription className="sr-only">
                  Biblioteca digital de mangás e histórias visuais.
                </SheetDescription>
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              <section>
                <p className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Navegação
                </p>
                <div className="mt-2 space-y-1">
                  {mobilePrimaryItems.map((item) => (
                    <MobileAction
                      key={item.key}
                      label={item.label}
                      icon={item.icon}
                      onClick={item.onClick}
                      active={item.active}
                    />
                  ))}
                </div>
              </section>

              {user ? (
                <section className="border-t border-border/60 pt-4">
                  <p className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Conta
                  </p>
                  <div className="mt-2 rounded-2xl border border-border/60 bg-background/25 px-3.5 py-3">
                    <p className="truncate text-sm font-semibold">
                      {profile?.display_name ?? user.email}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{roleLabel}</p>
                  </div>
                  <div className="mt-2 space-y-1">
                    <MobileAction label="Meu perfil" icon={<User className="size-[18px]" />} onClick={goProfile} />
                    {role === "admin" ? (
                      <MobileAction label="Minha loja" icon={<Store className="size-[18px]" />} onClick={goSellerArea} />
                    ) : null}
                    {role !== "editora" ? (
                      <MobileAction label="Favoritos" icon={<Heart className="size-[18px]" />} onClick={goToFavorites} />
                    ) : null}
                    {role !== "admin" && role !== "editora" ? (
                      <MobileAction label="Planos" icon={<Crown className="size-[18px]" />} onClick={goPlans} />
                    ) : null}
                    <MobileAction label="Personalização" icon={<Palette className="size-[18px]" />} onClick={goPersonalization} />
                  </div>
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <SheetClose asChild>
                      <button
                        onClick={() => void handleSignOut()}
                        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-sm font-medium text-destructive transition hover:bg-destructive/10"
                      >
                        <LogOut className="size-[18px]" /> Sair
                      </button>
                    </SheetClose>
                  </div>
                </section>
              ) : (
                <section className="border-t border-border/60 pt-4">
                  <MobileNavLink to="/auth" icon={<User className="size-[18px]" />} label="Entrar" />
                </section>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function DesktopNavItem({ item }: { item: HeaderNavItem }) {
  return (
    <button
      type="button"
      onClick={item.onClick}
      aria-label={item.label}
      title={item.label}
      className={cn(
        "relative flex h-11 shrink-0 items-center gap-2 rounded-[1rem] px-3.5 text-sm font-medium text-muted-foreground transition hover:bg-background/45 hover:text-foreground 2xl:px-4",
        item.active &&
          "bg-foreground text-background shadow-[0_10px_28px_-16px_rgba(255,255,255,.42)]",
      )}
    >
      {item.icon}
      <span className="hidden xl:inline">{item.label}</span>
      {item.showMarketplaceBadge ? (
        <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" aria-hidden="true" />
      ) : null}
    </button>
  );
}

function HeaderSearch({
  value,
  onChange,
  onSubmit,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  compact?: boolean;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn("relative shrink-0", compact ? "min-w-0 flex-1" : "w-[190px] 2xl:w-[240px]")}
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={compact ? "Buscar obras..." : "Buscar mangás, HQs, livros..."}
        className="h-10 w-full rounded-[0.95rem] border border-border/45 bg-background/45 pl-9 pr-3 text-base outline-none transition placeholder:text-muted-foreground/75 hover:bg-background/60 focus:border-primary/30 focus:bg-background/65 focus:ring-2 focus:ring-primary/12 sm:h-11 sm:rounded-[1rem] sm:pl-10 sm:pr-4 sm:text-sm"
      />
    </form>
  );
}

function MobileAction({
  label,
  icon,
  onClick,
  active = false,
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <SheetClose asChild>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-xl border border-transparent px-3.5 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted/55 hover:text-foreground",
          active && "border-primary/20 bg-primary/10 text-foreground shadow-sm hover:bg-primary/12",
        )}
      >
        {icon}
        <span>{label}</span>
      </button>
    </SheetClose>
  );
}

function MobileNavLink({
  to,
  icon,
  label,
}: {
  to: "/auth";
  icon: ReactNode;
  label: string;
}) {
  return (
    <SheetClose asChild>
      <Link
        to={to}
        className="flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition hover:bg-muted/55"
      >
        {icon}
        {label}
      </Link>
    </SheetClose>
  );
}
