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
