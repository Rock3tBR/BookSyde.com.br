-- BookSyde: lista de usuários apenas para administradores autenticados.
-- Execute no SQL Editor do projeto correto, como postgres.
-- Não altera contas, papéis, RLS existente ou dados.
-- A função tem acesso a auth.users, mas só devolve registros após checar admin.

BEGIN;

CREATE OR REPLACE FUNCTION public.booksyde_admin_list_users()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado à lista de usuários.' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'email', COALESCE(u.email, ''),
        'displayName', COALESCE(
          NULLIF(btrim(p.display_name), ''),
          NULLIF(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
          NULLIF(split_part(u.email, '@', 1), ''),
          'Leitor'
        ),
        'isAdmin', COALESCE(roles.is_admin, false),
        'isCreator', COALESCE(roles.is_creator, false),
        'isEditora', COALESCE(roles.is_editora, false),
        'blocked', (u.banned_until IS NOT NULL AND u.banned_until > now()),
        'planCode', COALESCE(active_plan.plan_code, 'none'),
        'planEndsAt', active_plan.current_period_end,
        'planProvider', active_plan.provider,
        'createdAt', u.created_at,
        'lastSignInAt', u.last_sign_in_at
      ) ORDER BY u.created_at DESC
    )
    FROM auth.users AS u
    LEFT JOIN public.profiles AS p ON p.id = u.id
    LEFT JOIN LATERAL (
      SELECT
        bool_or(r.role = 'admin'::public.app_role) AS is_admin,
        bool_or(r.role = 'creator'::public.app_role) AS is_creator,
        bool_or(r.role = 'editora'::public.app_role) AS is_editora
      FROM public.user_roles AS r
      WHERE r.user_id = u.id
    ) AS roles ON true
    LEFT JOIN LATERAL (
      SELECT s.plan_code, s.current_period_end, s.provider
      FROM public.subscriptions AS s
      WHERE s.user_id = u.id
        AND s.status IN ('active', 'trialing')
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
      ORDER BY s.current_period_end DESC NULLS FIRST
      LIMIT 1
    ) AS active_plan ON true
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.booksyde_admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booksyde_admin_list_users() TO authenticated;

COMMIT;
