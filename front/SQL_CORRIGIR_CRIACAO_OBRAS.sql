-- BookSyde | Correção: permission denied for table mangas ao criar obra.
-- SQL Editor do MESMO projeto Supabase do login. Idempotente.
-- Mantém os campos privados fora do SELECT direto de authenticated.
BEGIN;

CREATE OR REPLACE FUNCTION public.booksyde_private_work_fields(p_work_ids uuid[])
RETURNS TABLE (
  id uuid,
  invite_token text,
  licensed_purchase_url text,
  licensed_store_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $booksyde$
  SELECT m.id, m.invite_token, m.licensed_purchase_url, m.licensed_store_name
  FROM public.mangas AS m
  WHERE auth.uid() IS NOT NULL
    AND m.id = ANY(COALESCE(p_work_ids, ARRAY[]::uuid[]))
    AND (
      m.creator_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );
$booksyde$;

REVOKE ALL ON FUNCTION public.booksyde_private_work_fields(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booksyde_private_work_fields(uuid[]) TO authenticated;

-- Não conceder SELECT amplo sobre mangas: vazaria tokens e outros campos internos.
-- INSERT e SELECT dos campos públicos já são concedidos na migração principal.
COMMIT;
NOTIFY pgrst, 'reload schema';
