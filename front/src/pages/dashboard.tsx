import { Route } from "@/routes/dashboard";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AdminDashboard } from "@/components/AdminDashboard";
import { PublisherWorkspace } from "@/components/PublisherWorkspace";
import { Button } from "@/components/ui/button";
import { useAccessRole, useAuth } from "@/lib/auth";



export function DashboardPage() {
  const { user, loading } = useAuth();
  const { role, isLoading: loadingRole } = useAccessRole();

  if (loading || loadingRole) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-sm text-muted-foreground">
        Carregando dashboard…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl">Área restrita</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entre na sua conta para acessar o dashboard.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/auth">Entrar</Link>
        </Button>
      </main>
    );
  }

  if (role !== "editora" && role !== "admin") {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl">Sem permissão</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O dashboard é uma área separada destinada às editoras.
        </p>
        <Button className="mt-6" variant="outline" asChild>
          <Link to="/">Voltar para a Home</Link>
        </Button>
      </main>
    );
  }

  // A rota /dashboard é compartilhada no menu, mas a experiência é específica
  // por papel. Editoras usam o dashboard editorial de referência; admins
  // continuam na área administrativa própria.
  if (role === "editora") {
    return <PublisherWorkspace section="overview" />;
  }

  return (
    <main className="w-full px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-5 sm:py-10 lg:px-8 lg:py-3">
      <AdminDashboard />
    </main>
  );
}
