export type AppAccessRole = "admin" | "editora" | "seller" | "creator" | "client";

export function resolveAccessRole({
  isAdmin,
  isEditora,
  isSeller,
  isCreator,
}: {
  isAdmin?: boolean;
  isEditora?: boolean;
  isSeller?: boolean;
  isCreator?: boolean;
}): AppAccessRole {
  // A ordem é intencional. Editoras também possuem o papel creator no banco,
  // e administradores podem ter perfil de vendedor. O papel mais específico
  // precisa sempre vencer para que o header e as permissões sejam previsíveis.
  if (isAdmin) return "admin";
  if (isEditora) return "editora";
  if (isSeller) return "seller";
  if (isCreator) return "creator";
  return "client";
}

export function getAccessRoleLabel(role: AppAccessRole) {
  switch (role) {
    case "admin":
      return "Administrador";
    case "editora":
      return "Editora";
    case "seller":
      return "Vendedor";
    case "creator":
      return "Criador";
    default:
      return "Cliente";
  }
}

/**
 * Controle de acesso das áreas principais do produto.
 *
 * Rotas de leitura, detalhes de obra e páginas legais continuam acessíveis,
 * pois são partes do catálogo/fluxo normal e não representam áreas de gestão.
 * As APIs mantêm sua própria autorização no servidor.
 */
export function canAccessPath(role: AppAccessRole, pathname: string) {
  if (role === "admin") return true;
  if (pathname.startsWith("/api/")) return true;

  const isSellerCenter = pathname === "/marketplace/vendedor" || pathname === "/vendedor" || pathname.startsWith("/vendedor/");
  const isAdminCenter = pathname === "/admin" || pathname.startsWith("/admin/");
  const isPublisherCenter = pathname === "/editora" || pathname.startsWith("/editora/");
  if (isAdminCenter) return false;
  if (isPublisherCenter) return role === "editora";
  if (isSellerCenter) return role === "seller";
  if (pathname === "/dashboard") return role === "editora";
  if (pathname === "/studio") return role !== "client";

  if (role === "editora") {
    return (
      pathname === "/" ||
      pathname === "/biblioteca" ||
      pathname === "/auth" ||
      pathname === "/conta" ||
      pathname === "/meu-perfil" ||
      pathname === "/contato" ||
      pathname === "/termos" ||
      pathname === "/privacidade" ||
      pathname === "/direitos-autorais" ||
      pathname === "/reembolso" ||
      pathname.startsWith("/manga/") ||
      pathname.startsWith("/ler/")
    );
  }
  return true;
}
