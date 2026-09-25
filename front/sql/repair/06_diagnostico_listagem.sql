-- Diagnóstico somente leitura: executar no SQL Editor do MESMO Supabase usado no login.
-- Não executa a função como usuário do site: no SQL Editor auth.uid() não é a sua sessão do navegador.
-- Não cole tokens, senhas, service_role ou resultados com e-mails neste chat.
SELECT
  (SELECT COUNT(*) FROM auth.users) AS total_usuarios_auth,
  to_regclass('public.profiles') IS NOT NULL AS tabela_profiles_existe,
  to_regclass('public.user_roles') IS NOT NULL AS tabela_roles_existe,
  to_regclass('public.subscriptions') IS NOT NULL AS tabela_subscriptions_existe,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_role') AS funcao_has_role_existe,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'booksyde_admin_list_users') AS funcao_listagem_existe;

-- Se a função existir mas a tela apresentar 42501, conferir com a conta do
-- administrador e revisar as permissões do banco sem desativar RLS.
