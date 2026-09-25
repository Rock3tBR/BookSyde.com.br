import { useState } from "react";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  Mail,
  Search,
  UserPlus,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export type PlanCode =
  | "none"
  | "mangaka_plus_avulso_30d"
  | "mangaka_plus_mensal"
  | "mangaka_plus_semestral_180d"
  | "mangaka_plus_anual";

export type ManagedUser = {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  isCreator: boolean;
  isEditora: boolean;
  planCode: PlanCode;
  planEndsAt: string | null;
  planProvider: string | null;
  blocked: boolean;
  createdAt: string;
  lastSignInAt?: string | null;
};

export type AdminUserAction = {
  action: "set_account_type" | "set_admin" | "set_creator" | "set_editora" | "set_blocked" | "set_plan" | "reset_password";
  userId?: string;
  email?: string;
  value?: boolean;
  planCode?: PlanCode;
  accountType?: "user" | "creator" | "editora" | "admin";
};

export type NewAccountInput = {
  email: string;
  displayName: string;
  roles: Array<"admin" | "creator" | "editora">;
};

export type CreatedAccount = {
  email: string;
  temporaryPassword: string;
};

type UserFilter = "all" | "plus" | "free" | "admin" | "creator" | "editora" | "blocked";

const USERS_PER_PAGE = 12;

const plans: Array<{ value: PlanCode; label: string }> = [
  { value: "none", label: "Grátis / sem plano" },
  { value: "mangaka_plus_avulso_30d", label: "Plus Avulso (30 dias)" },
  { value: "mangaka_plus_mensal", label: "Plus Mensal" },
  { value: "mangaka_plus_semestral_180d", label: "Plus Semestral" },
  { value: "mangaka_plus_anual", label: "Plus Anual" },
];

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function formatDate(value: string | null | undefined) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Não informado";
  return new Date(value).toLocaleDateString("pt-BR");
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "US";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

export function AdminUsersPanel({
  users,
  currentUserId,
  loading,
  error,
  pending,
  onRetry,
  onAction,
  onCreateAccount,
  creatingAccount,
  createdAccount,
  onDismissCreatedAccount,
}: {
  users: ManagedUser[];
  currentUserId: string;
  loading: boolean;
  error: string | null;
  pending: boolean;
  onRetry: () => void;
  onAction: (action: AdminUserAction) => void;
  onCreateAccount: (input: NewAccountInput) => void;
  creatingAccount: boolean;
  createdAccount: CreatedAccount | null;
  onDismissCreatedAccount: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRoles, setNewRoles] = useState<Array<"admin" | "creator" | "editora">>([]);

  const normalizedSearch = normalize(search.trim());
  const filteredUsers = users.filter((user) => {
    const matchesSearch = normalize(`${user.displayName} ${user.email}`).includes(normalizedSearch);
    const matchesFilter =
      filter === "all" ||
      (filter === "plus" && user.planCode !== "none") ||
      (filter === "free" && user.planCode === "none") ||
      (filter === "blocked" && user.blocked) ||
      (filter === "admin" && user.isAdmin) ||
      (filter === "creator" && user.isCreator) ||
      (filter === "editora" && user.isEditora);

    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleUsers = filteredUsers.slice(
    currentPage * USERS_PER_PAGE,
    currentPage * USERS_PER_PAGE + USERS_PER_PAGE,
  );
  const selectedUser = visibleUsers.find((user) => user.id === selectedId) ?? visibleUsers[0];
  const isCurrentUser = selectedUser?.id === currentUserId;
  const disableAccountChanges = pending || isCurrentUser;

  return (
    <section className="ink-panel min-w-0 space-y-4 rounded-[1.2rem] p-3.5 sm:rounded-2xl sm:p-6">
      <div>
        <h2 className="font-display text-lg sm:text-xl">Controle de usuários</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione um usuário à esquerda para visualizar e gerenciar os detalhes à direita.
        </p>
      </div>

      {createdAccount ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-semibold">Conta criada</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Copie a senha temporária agora — ela não será exibida novamente. Repasse ao usuário por um
            canal seguro e peça para trocá-la no primeiro acesso.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">E-mail</p>
              <p className="break-all text-sm font-medium">{createdAccount.email}</p>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
              <div>
                <p className="text-[11px] text-muted-foreground">Senha temporária</p>
                <p className="font-sans text-sm font-medium">{createdAccount.temporaryPassword}</p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Copiar senha temporária"
                onClick={() => void navigator.clipboard.writeText(createdAccount.temporaryPassword)}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <Button variant="link" className="mt-1 h-auto px-0" onClick={onDismissCreatedAccount}>
            Ok, já copiei
          </Button>
        </div>
      ) : null}

      <div className="rounded-xl border border-border/60 bg-background/35 p-3.5">
        <button
          type="button"
          onClick={() => setCreatingOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="size-4 text-primary" /> Criar conta
          </span>
          <span className="text-xs text-muted-foreground">{creatingOpen ? "Fechar" : "Abrir"}</span>
        </button>

        {creatingOpen ? (
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!newEmail.trim()) return;
              onCreateAccount({ email: newEmail.trim(), displayName: newDisplayName.trim(), roles: newRoles });
            }}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="new-account-email">
                  E-mail *
                </label>
                <Input
                  id="new-account-email"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="pessoa@exemplo.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="new-account-name">
                  Nome (opcional)
                </label>
                <Input
                  id="new-account-name"
                  value={newDisplayName}
                  onChange={(event) => setNewDisplayName(event.target.value)}
                  placeholder="Nome de exibição"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["creator", "Criador"],
                  ["editora", "Editora"],
                  ["admin", "Admin"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={newRoles.includes(value)}
                    onCheckedChange={(checked) =>
                      setNewRoles((current) =>
                        checked === true
                          ? [...current, value]
                          : current.filter((role) => role !== value),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Uma senha temporária é gerada automaticamente. Editora concede também o papel Criador
              (necessário para publicar) e trava a publicação no Catálogo.
            </p>

            <Button type="submit" disabled={creatingAccount || !newEmail.trim()}>
              {creatingAccount ? "Criando…" : "Criar conta"}
            </Button>
          </form>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm">
          <p className="font-semibold">Não foi possível carregar os usuários.</p>
          <p className="mt-1 whitespace-pre-line text-xs">{error}</p>
          <Button variant="link" className="h-auto px-2" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_340px]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className="relative block">
              <span className="sr-only">Buscar usuários</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail…"
                className="pl-9"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </label>

            <select
              aria-label="Filtrar usuários"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as UserFilter);
                setPage(0);
              }}
            >
              <option value="all">Todos os usuários</option>
              <option value="plus">Plus</option>
              <option value="free">Grátis</option>
              <option value="admin">Administradores</option>
              <option value="creator">Criadores</option>
              <option value="editora">Editoras</option>
              <option value="blocked">Bloqueados</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {loading ? "Carregando usuários…" : error ? "Listagem indisponível" : `${filteredUsers.length} usuário(s) encontrado(s)`}
            </p>
            {filteredUsers.length > USERS_PER_PAGE ? (
              <p className="text-xs text-muted-foreground">
                Página {currentPage + 1} de {totalPages}
              </p>
            ) : null}
          </div>

          {loading ? (
            <div role="status" className="space-y-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-[74px] animate-pulse rounded-2xl bg-muted" />
              ))}
              <span className="sr-only">Carregando usuários…</span>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleUsers.map((user) => {
                const active = selectedUser?.id === user.id;
                return (
                  <button
                    type="button"
                    key={user.id}
                    aria-pressed={active}
                    onClick={() => setSelectedId(user.id)}
                    className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:p-4 ${
                      active
                        ? "border-primary/60 bg-primary/10 shadow-sm"
                        : "border-border/60 bg-background/35 hover:border-border hover:bg-muted/40"
                    }`}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary sm:size-11">
                      {getInitials(user.displayName)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {user.displayName}
                        {user.id === currentUserId ? " (você)" : ""}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                        {user.isAdmin ? <span>Admin</span> : null}
                        {user.isCreator ? <span>Criador</span> : null}
                        {user.isEditora ? <span>Editora</span> : null}
                        {user.blocked ? <span className="text-destructive">Bloqueado</span> : null}
                      </span>
                    </span>

                    <Badge
                      variant={user.planCode !== "none" ? "default" : "secondary"}
                      className="shrink-0"
                    >
                      {user.planCode !== "none" ? "Plus" : "Grátis"}
                    </Badge>
                    <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
                  </button>
                );
              })}

              {!visibleUsers.length && !error && !loading ? (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado para estes filtros.
                </p>
              ) : null}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-3">
              <Button
                size="icon"
                variant="outline"
                aria-label="Página anterior de usuários"
                disabled={currentPage === 0}
                onClick={() => setPage(Math.max(0, currentPage - 1))}
              >
                <ChevronLeft />
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {currentPage + 1} de {totalPages}
              </span>
              <Button
                size="icon"
                variant="outline"
                aria-label="Próxima página de usuários"
                disabled={currentPage + 1 === totalPages}
                onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
              >
                <ChevronRight />
              </Button>
            </div>
          ) : null}
        </div>

        <aside
          aria-label="Detalhes do usuário"
          className="min-w-0 self-start rounded-2xl border border-border/70 bg-background/45 p-4 sm:p-5 xl:sticky xl:top-28"
        >
          {selectedUser ? (
            <>
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-lg font-bold text-primary">
                  {getInitials(selectedUser.displayName)}
                </span>
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-semibold">{selectedUser.displayName}</h3>
                  <p className="break-all text-xs text-muted-foreground">{selectedUser.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant={selectedUser.planCode !== "none" ? "default" : "secondary"}>
                      {selectedUser.planCode !== "none" ? "Plus" : "Grátis"}
                    </Badge>
                    {selectedUser.isAdmin ? <Badge variant="outline">Admin</Badge> : null}
                    {selectedUser.isCreator ? <Badge variant="outline">Criador</Badge> : null}
                    {selectedUser.isEditora ? <Badge variant="outline">Editora</Badge> : null}
                    {selectedUser.blocked ? <Badge variant="destructive">Bloqueado</Badge> : null}
                  </div>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 border-b border-border/60 pb-5 text-xs">
                <div>
                  <dt className="text-muted-foreground">Cadastro</dt>
                  <dd className="mt-1 font-medium">{formatDate(selectedUser.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Último login</dt>
                  <dd className="mt-1 font-medium">{formatDate(selectedUser.lastSignInAt)}</dd>
                </div>
              </dl>

              <div className="mt-5 space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <Crown className="size-4 text-primary" /> Plano
                </h4>
                <label className="block text-xs text-muted-foreground" htmlFor="managed-plan">
                  Plano do usuário
                </label>
                <select
                  id="managed-plan"
                  className="min-h-11 w-full min-w-0 rounded-xl border bg-background px-3 text-sm"
                  value={selectedUser.planCode}
                  disabled={disableAccountChanges}
                  onChange={(event) =>
                    onAction({
                      action: "set_plan",
                      userId: selectedUser.id,
                      planCode: event.target.value as PlanCode,
                    })
                  }
                >
                  {plans.map((plan) => (
                    <option key={plan.value} value={plan.value}>
                      {plan.label}
                    </option>
                  ))}
                </select>

                {selectedUser.planEndsAt ? (
                  <p className="text-xs text-muted-foreground">
                    Válido até {formatDate(selectedUser.planEndsAt)}
                    {selectedUser.planProvider
                      ? ` · ${
                          selectedUser.planProvider === "admin"
                            ? "Concedido pela administração"
                            : selectedUser.planProvider
                        }`
                      : ""}
                  </p>
                ) : null}
              </div>

              <div className="mt-5 space-y-3 border-t border-border/60 pt-5">
                <h4 className="text-sm font-semibold">Permissões e acesso</h4>
                <label className="block text-xs text-muted-foreground" htmlFor="managed-account-type">
                  Tipo de conta
                </label>
                <select
                  id="managed-account-type"
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  value={selectedUser.isAdmin ? "admin" : selectedUser.isEditora ? "editora" : selectedUser.isCreator ? "creator" : "user"}
                  disabled={disableAccountChanges}
                  onChange={(event) => {
                    const accountType = event.target.value as "user" | "creator" | "editora" | "admin";
                    onAction({ action: "set_account_type", userId: selectedUser.id, accountType });
                  }}
                >
                  <option value="user">Cliente</option>
                  <option value="creator">Criador</option>
                  <option value="editora">Editora</option>
                  <option value="admin">Administrador</option>
                </select>
                <p className="text-xs text-muted-foreground">A alteração substitui o tipo de acesso da conta; uma editora também recebe a permissão de criador. Assinaturas e cadastro de vendedor não são alterados.</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <Button
                    variant="outline"
                    disabled={disableAccountChanges}
                    onClick={() =>
                      onAction({
                        action: "set_blocked",
                        userId: selectedUser.id,
                        value: !selectedUser.blocked,
                      })
                    }
                  >
                    {selectedUser.blocked ? <UserRoundCheck /> : <Ban />}
                    {selectedUser.blocked ? "Desbloquear" : "Bloquear"}
                  </Button>

                  <Button
                    variant="outline"
                    disabled={pending || !selectedUser.email}
                    onClick={() =>
                      onAction({ action: "reset_password", email: selectedUser.email })
                    }
                  >
                    <Mail /> Trocar senha
                  </Button>
                </div>

                {isCurrentUser ? (
                  <p className="text-xs text-muted-foreground">
                    As permissões e o plano da sua própria conta não podem ser alterados aqui.
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="mx-auto mb-3 size-8" />
              <p className="text-sm">Selecione um usuário na lista para ver os detalhes.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
