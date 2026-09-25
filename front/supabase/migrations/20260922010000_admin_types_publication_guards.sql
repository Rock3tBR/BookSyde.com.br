-- BookSyde · correção de tipo de conta + proteção de publicação.
-- Execute este arquivo UMA VEZ no SQL Editor do MESMO projeto do login.
-- Idempotente: as funções são substituídas e as políticas nomeadas são recriadas.
-- Requer o esquema principal BookSyde e a função public.is_creator já instalados.

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

-- BookSyde: protege criação/edição de obras após mudança de tipo da conta.
-- Rodar no mesmo projeto Supabase do login após a instalação do esquema principal.
-- Não concede leitura de livros nem desativa RLS. Não modifica linhas existentes.
BEGIN;

-- O esquema original permitia que qualquer autenticado criasse/editasse obras
-- se fosse o creator_id. Exija também papel de publicação (criador/editora/admin).
DROP POLICY IF EXISTS booksyde_publisher_only_insert ON public.mangas;
CREATE POLICY booksyde_publisher_only_insert ON public.mangas AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (public.is_creator(auth.uid()));

DROP POLICY IF EXISTS booksyde_publisher_only_update ON public.mangas;
CREATE POLICY booksyde_publisher_only_update ON public.mangas AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.is_creator(auth.uid()))
  WITH CHECK (public.is_creator(auth.uid()));

DROP POLICY IF EXISTS booksyde_publisher_only_delete ON public.mangas;
CREATE POLICY booksyde_publisher_only_delete ON public.mangas AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (public.is_creator(auth.uid()));

-- Impede que contas rebaixadas continuem criando volumes/páginas pela API.
-- Continua exigindo ser dono da obra ou administrador.
CREATE OR REPLACE FUNCTION public.can_manage_publication(_manga_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $booksyde$
  SELECT auth.uid() IS NOT NULL
    AND public.is_creator(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.mangas m
      WHERE m.id = _manga_id
        AND (m.creator_id = auth.uid()
             OR public.has_role(auth.uid(), 'admin'::public.app_role))
    );
$booksyde$;
REVOKE ALL ON FUNCTION public.can_manage_publication(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_publication(uuid) TO authenticated;

-- Compatibilidade com capas antigas em <criador_id>/cover-... no bucket privado.
-- Só permite ler imagem explicitamente vinculada a uma obra pública de Catálogo.
DROP POLICY IF EXISTS booksyde_linked_cover_public_read ON storage.objects;
CREATE POLICY booksyde_linked_cover_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'manga-covers'
    AND EXISTS (
      SELECT 1 FROM public.mangas m
      WHERE m.cover_url = 'storage:' || name
        AND m.visibility = 'public'
        AND m.distribution_channel = 'catalog'
    )
  );
COMMIT;
