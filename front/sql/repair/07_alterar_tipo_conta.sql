-- BookSyde: alterar tipo da conta pelo cliente autenticado sem service_role.
-- Execute NO MESMO projeto Supabase do login, no SQL Editor.
-- Não modifica usuários existentes ao instalar. RLS permanece ativo.
BEGIN;
CREATE OR REPLACE FUNCTION public.booksyde_admin_set_account_type(
  p_user_id uuid,
  p_account_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $booksyde$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Somente um administrador autenticado pode alterar contas.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_user_id = v_admin THEN
    RAISE EXCEPTION 'Você não pode alterar o tipo da própria conta.' USING ERRCODE = '22023';
  END IF;
  IF p_account_type IS NULL OR p_account_type NOT IN ('user','creator','editora','admin') THEN
    RAISE EXCEPTION 'Tipo de conta inválido.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  -- A alteração é atômica: se uma operação falhar, nenhuma mudança é aplicada.
  -- A função de usuário padrão é preservada, bem como plano/assinatura e vendedor.
  DELETE FROM public.user_roles
   WHERE user_id = p_user_id
     AND role IN ('admin'::public.app_role, 'creator'::public.app_role, 'editora'::public.app_role);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'user'::public.app_role)
  ON CONFLICT (user_id,role) DO NOTHING;
  IF p_account_type = 'editora' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id,'creator'::public.app_role), (p_user_id,'editora'::public.app_role)
    ON CONFLICT (user_id,role) DO NOTHING;
  ELSIF p_account_type = 'creator' OR p_account_type = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, p_account_type::public.app_role)
    ON CONFLICT (user_id,role) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok',true,'userId',p_user_id,'accountType',p_account_type);
END;
$booksyde$;
REVOKE ALL ON FUNCTION public.booksyde_admin_set_account_type(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booksyde_admin_set_account_type(uuid,text) TO authenticated;
COMMIT;
