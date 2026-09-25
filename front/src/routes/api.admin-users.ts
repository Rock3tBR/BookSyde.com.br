import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseFetch } from "@/integrations/supabase/api-key-fetch";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/admin-users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = await requireAdmin(request);
        if (admin instanceof Response) return admin;
        // A listagem usa uma função SQL que valida o papel de admin no próprio
        // banco antes de acessar auth.users. Não exige service_role no navegador
        // nem no servidor. Instale sql/repair/05_listagem_usuarios_admin.sql.
        const token = getBearerToken(request)!;
        const supabase = createUserScopedClient(token);
        const { data, error } = await supabase.rpc("booksyde_admin_list_users");
        if (error) {
          if (error.code === "PGRST202" || error.message.includes("schema cache")) {
            return json({
              error: "A listagem ainda não foi instalada. Execute sql/repair/05_listagem_usuarios_admin.sql no SQL Editor do Supabase e recarregue a página.",
            }, 503);
          }
          if (error.code === "42501") return json({ error: "Acesso negado à lista de usuários." }, 403);
          console.error("[admin-users] Falha ao consultar a lista:", error.code);
          return json({ error: "Erro na consulta de usuários. Confira a função booksyde_admin_list_users no Supabase." }, 500);
        }
        if (!Array.isArray(data)) {
          return json({ error: "Formato de resposta inesperado ao carregar usuários." }, 500);
        }
        return json({ users: data });
      },
      POST: async ({ request }) => {
        const currentAdmin = await requireAdmin(request);
        if (currentAdmin instanceof Response) return currentAdmin;
        // Escritas administrativas exigem a chave privilegiada apenas no servidor.
        // A listagem GET funciona sem ela, pela função SQL autorizada.
        if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
          return json({
            error: "Para criar ou alterar usuários, configure SUPABASE_SERVICE_ROLE_KEY nas variáveis privadas do servidor. Nunca use VITE_ nem exponha a chave no navegador.",
          }, 503);
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const body = (await request.json()) as {
          action?:
            | "set_admin"
            | "set_creator"
            | "set_editora"
            | "set_blocked"
            | "set_plan"
            | "reset_password"
            | "create_user";
          userId?: string;
          email?: string;
          value?: boolean;
          displayName?: string;
          roles?: Array<"admin" | "creator" | "editora">;
          planCode?:
            | "none"
            | "mangaka_plus_avulso_30d"
            | "mangaka_plus_mensal"
            | "mangaka_plus_semestral_180d"
            | "mangaka_plus_anual";
        };

        if (body.action !== "reset_password" && body.action !== "create_user" && body.userId === currentAdmin.id) {
          return json({ error: "Você não pode alterar o acesso da própria conta." }, 400);
        }

        if (body.action === "create_user") {
          const requestedRoles = body.roles ?? [];
          if (!Array.isArray(requestedRoles) || requestedRoles.some(
            (role) => !["admin", "creator", "editora"].includes(role),
          )) {
            return json({ error: "Função de usuário inválida." }, 400);
          }
          const email = body.email?.trim().toLowerCase();
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return json({ error: "Informe um e-mail válido." }, 400);
          }

          // Senha temporária gerada no servidor. O admin repassa essa senha
          // ao usuário por fora (e-mail, WhatsApp etc.); não guardamos texto
          // puro em lugar nenhum além desta resposta única.
          const temporaryPassword = generateTemporaryPassword();

          const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: temporaryPassword,
            email_confirm: true,
            ...(body.displayName ? { user_metadata: { display_name: body.displayName } } : {}),
          });
          if (createError || !created.user) {
            return json({ error: createError?.message ?? "Não foi possível criar a conta." }, 400);
          }

          if (body.displayName) {
            const { error: profileError } = await supabaseAdmin
              .from("profiles")
              .upsert({ id: created.user.id, display_name: body.displayName }, { onConflict: "id" });
            if (profileError) {
              console.error("[admin-users] Perfil da nova conta:", profileError.code);
            }
          }

          // As permissões escolhidas na tela agora são efetivamente gravadas.
          // A editora também recebe o papel de criador.
          const roles = [...new Set([
            ...requestedRoles,
            ...(requestedRoles.includes("editora") ? ["creator" as const] : []),
          ])];
          if (roles.length) {
            const { error: rolesError } = await supabaseAdmin
              .from("user_roles")
              .upsert(roles.map((role) => ({ user_id: created.user.id, role })), {
                onConflict: "user_id,role",
              });
            if (rolesError) {
              // Não apagamos silenciosamente uma conta já criada.
              console.error("[admin-users] Permissões da nova conta:", rolesError.code);
              return json({ error: "Conta criada, mas não foi possível atribuir as permissões selecionadas. Verifique o usuário no Supabase antes de tentar de novo." }, 500);
            }
          }

          return json({
            ok: true,
            userId: created.user.id,
            email,
            temporaryPassword,
          });
        }

        if (body.action === "set_admin" && body.userId) {
          const result = body.value
            ? await supabaseAdmin
                .from("user_roles")
                .upsert({ user_id: body.userId, role: "admin" }, { onConflict: "user_id,role" })
            : await supabaseAdmin
                .from("user_roles")
                .delete()
                .eq("user_id", body.userId)
                .eq("role", "admin");
          if (result.error) return json({ error: result.error.message }, 400);
          return json({ ok: true });
        }

        if (body.action === "set_creator" && body.userId) {
          const result = body.value
            ? await supabaseAdmin
                .from("user_roles")
                .upsert({ user_id: body.userId, role: "creator" }, { onConflict: "user_id,role" })
            : await supabaseAdmin
                .from("user_roles")
                .delete()
                .eq("user_id", body.userId)
                .eq("role", "creator");
          if (result.error) return json({ error: result.error.message }, 400);
          return json({ ok: true });
        }

        if (body.action === "set_editora" && body.userId) {
          // Editora depende do papel "creator" para as mesmas permissões de
          // escrita já existentes em mangas/volumes — a trava de destino
          // (sempre Catálogo, nunca Marketplace) é feita no app, não aqui.
          if (body.value) {
            const [creatorResult, editoraResult] = await Promise.all([
              supabaseAdmin
                .from("user_roles")
                .upsert({ user_id: body.userId, role: "creator" }, { onConflict: "user_id,role" }),
              supabaseAdmin
                .from("user_roles")
                .upsert({ user_id: body.userId, role: "editora" }, { onConflict: "user_id,role" }),
            ]);
            if (creatorResult.error) return json({ error: creatorResult.error.message }, 400);
            if (editoraResult.error) return json({ error: editoraResult.error.message }, 400);
          } else {
            const result = await supabaseAdmin
              .from("user_roles")
              .delete()
              .eq("user_id", body.userId)
              .eq("role", "editora");
            if (result.error) return json({ error: result.error.message }, 400);
          }
          return json({ ok: true });
        }

        if (body.action === "set_blocked" && body.userId) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(body.userId, {
            ban_duration: body.value ? "876000h" : "none",
          });
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }

        if (body.action === "set_plan" && body.userId && body.planCode) {
          if (
            ![
              "none",
              "mangaka_plus_avulso_30d",
              "mangaka_plus_mensal",
              "mangaka_plus_semestral_180d",
              "mangaka_plus_anual",
            ].includes(body.planCode)
          ) {
            return json({ error: "Plano inválido." }, 400);
          }
          const providerRef = `manual:${body.userId}`;
          if (body.planCode === "none") {
            const { error } = await supabaseAdmin
              .from("subscriptions")
              .update({
                status: "canceled",
                current_period_end: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", body.userId)
              .eq("provider", "admin");
            if (error) return subscriptionError(error.message);
            return json({ ok: true });
          }

          const periodEnd = new Date();
          if (body.planCode === "mangaka_plus_avulso_30d") periodEnd.setDate(periodEnd.getDate() + 30);
          if (body.planCode === "mangaka_plus_mensal") periodEnd.setMonth(periodEnd.getMonth() + 1);
          if (body.planCode === "mangaka_plus_semestral_180d") periodEnd.setDate(periodEnd.getDate() + 180);
          if (body.planCode === "mangaka_plus_anual") periodEnd.setFullYear(periodEnd.getFullYear() + 1);

          const { error } = await supabaseAdmin.from("subscriptions").upsert(
            {
              user_id: body.userId,
              plan_code: body.planCode,
              status: "active",
              current_period_end: periodEnd.toISOString(),
              provider: "admin",
              provider_ref: providerRef,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "provider,provider_ref" },
          );
          if (error) return subscriptionError(error.message);
          return json({ ok: true });
        }

        if (body.action === "reset_password" && body.email) {
          const redirectTo = `${new URL(request.url).origin}/auth`;
          const { error } = await supabaseAdmin.auth.resetPasswordForEmail(body.email, {
            redirectTo,
          });
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }

        return json({ error: "Ação inválida." }, 400);
      },
    },
  },
});

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

function createUserScopedClient(token: string) {
  const url = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) {
    throw new Error("Servidor sem SUPABASE_URL ou SUPABASE_PUBLISHABLE_KEY.");
  }
  return createClient<Database>(url, publishableKey, {
    global: {
      fetch: createSupabaseFetch(publishableKey),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function requireAdmin(request: Request) {
  const token = getBearerToken(request);
  if (!token) return json({ error: "Não autorizado." }, 401);
  const supabase = createUserScopedClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return json({ error: "Sessão inválida." }, 401);
  const { data: role, error: roleError } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (roleError) {
    console.error("[admin-users] Falha ao verificar administrador:", roleError.code);
    return json({ error: "Não foi possível verificar as permissões de administrador." }, 503);
  }
  if (!role) return json({ error: "Acesso negado." }, 403);
  return data.user;
}

function generateTemporaryPassword() {
  // 12 caracteres, com letras maiúsculas/minúsculas, números e um símbolo —
  // suficiente para o primeiro acesso; o usuário deve trocar a senha depois.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const symbols = "!@#$%";
  const bytes = new Uint32Array(11);
  crypto.getRandomValues(bytes);
  let password = "";
  for (let i = 0; i < 11; i += 1) {
    password += alphabet[bytes[i]! % alphabet.length];
  }
  password += symbols[bytes[0]! % symbols.length];
  return password;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function isMissingSubscriptionsTable(message: string) {
  return message.includes("subscriptions") && (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("Could not find")
  );
}

function subscriptionError(message: string) {
  if (isMissingSubscriptionsTable(message)) {
    return json(
      { error: "A migration de assinaturas ainda não foi aplicada no Supabase." },
      503,
    );
  }
  return json({ error: message }, 400);
}
