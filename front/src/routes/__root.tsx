import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, PreferencesSync } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CommunityDock } from "@/components/CommunityDock";
import { BackgroundUploadStatus } from "@/components/BackgroundUploadStatus";
import { OfflineDownloadStatus } from "@/components/OfflineDownloadStatus";
import { TutorialGate } from "@/components/TutorialGate";
import { PublisherDemoTour } from "@/components/PublisherDemoTour";
import { SystemAccessGuard } from "@/components/SystemAccessGuard";
import { FirstVisitPreferences } from "@/components/FirstVisitPreferences";
import { RealisticExperienceBridge } from "@/components/RealisticExperienceBridge";
import { OfflineGate } from "@/components/OfflineGate";
import { cacheOfflineAppShell, getOfflineVolume, getOfflineVolumeIds } from "@/lib/offlineVolumes";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao catálogo
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado. Tente novamente ou volte para o catálogo.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      // Safari no iOS reescreve o HTML detectando telefones/datas e isso quebra
      // a hidratação do React (a tela abre e depois cai no erro).
      { name: "format-detection", content: "telephone=no,date=no,address=no,email=no" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "theme-color", content: "#172522" },

      { title: "BookSyde — sua biblioteca digital" },
      { name: "application-name", content: "BookSyde" },
      { name: "apple-mobile-web-app-title", content: "BookSyde" },
      {
        name: "description",
        content: "Leia mangás em um leitor digital elegante, imersivo e personalizável.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "BookSyde" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Nunito+Sans:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/booksyde-favicon.png?v=2", type: "image/png", sizes: "64x64" },
      { rel: "shortcut icon", href: "/booksyde-favicon.png?v=2", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=2", sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest?v=6" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light" style={{ colorScheme: "light" }}>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-background">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Safari (iOS) dispara erro se um chunk antigo ficou em cache depois de um
    // deploy. Nesse caso limpamos o cache do app e recarregamos uma única vez.
    const onChunkFailure = async (message: string) => {
      if (/sw\.js|service ?worker/i.test(message)) return;
      if (
        !/importing a module script failed|dynamically imported module|failed to fetch dynamically|chunk/i.test(
          message,
        )
      )
        return;

      if (sessionStorage.getItem("mangaka-cache-reset") === "1") return;
      sessionStorage.setItem("mangaka-cache-reset", "1");
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        }
      } catch {
        // ignora: recarregar já costuma resolver
      }
      window.location.reload();
    };
    const onError = (event: ErrorEvent) => void onChunkFailure(String(event.message ?? ""));
    const onRejection = (event: PromiseRejectionEvent) =>
      void onChunkFailure(String((event.reason as Error)?.message ?? event.reason ?? ""));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    if (!("serviceWorker" in navigator)) {
      return () => {
        window.removeEventListener("error", onError);
        window.removeEventListener("unhandledrejection", onRejection);
      };
    }

    const reloadForUpdate = () => {
      if (sessionStorage.getItem("mangaka-sw-reloaded") === "v9") return;
      sessionStorage.setItem("mangaka-sw-reloaded", "v9");
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reloadForUpdate);
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await registration.update();
        await navigator.serviceWorker.ready;
        if (!navigator.onLine) return;
        // Prepara e guarda o leitor da versão atual, inclusive para downloads
        // feitos antes desta atualização.
        if (getOfflineVolumeIds().length > 0) {
          // Preserva downloads de versões anteriores, sem baixar o leitor para
          // quem nunca salvou um livro offline.
          const offlineIds = getOfflineVolumeIds();
          await Promise.all([
            import("./ler.$volumeId"),
            import("@/pages/ler.$volumeId"),
            import("@/components/OfflineMode"),
            ...(offlineIds.some((id) => getOfflineVolume(id)?.fileFormat === "epub")
              ? [import("@/components/EpubReader")]
              : []),
          ]);
          await cacheOfflineAppShell();
        }
      } catch {
        // Safari em navegação privada (e outros contextos) bloqueia o service
        // worker; o app precisa continuar funcionando normalmente.
      }
    })();
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      navigator.serviceWorker.removeEventListener("controllerchange", reloadForUpdate);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PreferencesSync />
        <RealisticExperienceBridge />
        <FirstVisitPreferences />
        <OfflineGate>
          <SiteHeader />
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <SystemAccessGuard>
            <Outlet />
          </SystemAccessGuard>
          <TutorialGate />
          <PublisherDemoTour />
          <SiteFooter />
          <CommunityDock />
          <BackgroundUploadStatus />
          <OfflineDownloadStatus />
          <Toaster />
        </OfflineGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}
