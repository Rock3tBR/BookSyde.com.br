import { Link, useRouterState } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useAccessRole, useAuth } from "@/lib/auth";
import { canAccessPath, getAccessRoleLabel } from "@/lib/access";

export function SystemAccessGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { role, isLoading } = useAccessRole();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // Visitantes continuam com o comportamento público já existente em cada rota.
  // Rotas protegidas como /admin e /studio também possuem validação própria.
  if (!user) return <>{children}</>;

  if (isLoading || !role) {
    return (
      <main className="mx-auto grid min-h-[45vh] max-w-3xl place-items-center px-4 py-16 text-sm text-muted-foreground">
        Verificando permissões…
      </main>
    );
  }

  if (canAccessPath(role, pathname)) return <>{children}</>;

  return (
    <main className="mx-auto grid min-h-[55vh] max-w-lg place-items-center px-4 py-16 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-border/70 bg-card text-primary">
          <LockKeyhole className="size-5" />
        </span>
        <h1 className="mt-4 font-display text-2xl">Área sem permissão</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Esta página não faz parte das áreas liberadas para o perfil {getAccessRoleLabel(role)}.
        </p>
        <Button asChild className="mt-6 rounded-xl">
          <Link to="/">Voltar para a Home</Link>
        </Button>
      </div>
    </main>
  );
}
