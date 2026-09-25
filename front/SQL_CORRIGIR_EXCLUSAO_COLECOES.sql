-- BookSyde | Correção de exclusão de obras/coleções
-- Execute no SQL Editor do Supabase. Seguro para executar mais de uma vez.

CREATE OR REPLACE FUNCTION public.can_manage_publication(_manga_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $booksyde$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.mangas m
      WHERE m.id = _manga_id
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR (public.is_creator(auth.uid()) AND m.creator_id = auth.uid())
        )
    );
$booksyde$;

REVOKE ALL ON FUNCTION public.can_manage_publication(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_publication(uuid) TO authenticated;

-- Remove referências antigas de anúncios que podem manter uma coleção apagada visível.
CREATE OR REPLACE FUNCTION public.booksyde_delete_publication(
 p_manga_id uuid DEFAULT NULL,p_volume_id uuid DEFAULT NULL,
 p_reason text DEFAULT NULL,p_details text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $delete$
DECLARE me uuid:=auth.uid(); work public.mangas%rowtype; units uuid[]; admin boolean;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Faça login.' USING ERRCODE='42501'; END IF;
 IF (p_manga_id IS NULL) = (p_volume_id IS NULL) THEN RAISE EXCEPTION 'Informe uma obra ou um volume.' USING ERRCODE='22023'; END IF;
 SELECT m.* INTO work FROM public.mangas m
 WHERE m.id=COALESCE(p_manga_id,(SELECT v.manga_id FROM public.volumes v WHERE v.id=p_volume_id)) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Publicação não encontrada.' USING ERRCODE='P0002'; END IF;
 IF NOT public.can_manage_publication(work.id) THEN RAISE EXCEPTION 'Sem permissão para apagar esta publicação.' USING ERRCODE='42501'; END IF;
 admin:=public.has_role(me,'admin');
 IF p_manga_id IS NOT NULL AND admin AND nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Informe o motivo da remoção.' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.volumes v WHERE v.manga_id=work.id AND (p_volume_id IS NULL OR v.id=p_volume_id) FOR UPDATE;
 SELECT COALESCE(array_agg(v.id),ARRAY[]::uuid[]) INTO units FROM public.volumes v WHERE v.manga_id=work.id AND (p_volume_id IS NULL OR v.id=p_volume_id);
 IF p_volume_id IS NOT NULL AND cardinality(units)=0 THEN RAISE EXCEPTION 'Publicação não encontrada.' USING ERRCODE='P0002'; END IF;

 INSERT INTO public.publication_cleanup(requested_by,bucket_id,object_path)
 SELECT DISTINCT me,asset.bucket,asset.path FROM (
   SELECT 'manga-pages' AS bucket,p.storage_path AS path FROM public.pages p WHERE p.volume_id=ANY(units)
   UNION ALL SELECT 'volume-sources',v.source_path FROM public.volumes v WHERE v.id=ANY(units)
   UNION ALL SELECT 'manga-covers',substr(v.cover_url,9) FROM public.volumes v WHERE v.id=ANY(units) AND v.cover_url LIKE 'storage:%'
   UNION ALL SELECT 'manga-covers',substr(work.cover_url,9) WHERE p_manga_id IS NOT NULL AND work.cover_url LIKE 'storage:%'
   UNION ALL SELECT 'manga-covers',work.id::text||'/'||v::text||'-preview-page-10.png' FROM unnest(units) v
 ) asset
 WHERE asset.path IS NOT NULL AND (split_part(asset.path,'/',1)=work.id::text OR (asset.bucket='manga-covers' AND split_part(asset.path,'/',1)=work.creator_id::text))
 AND NOT EXISTS(SELECT 1 FROM public.mangas m WHERE m.cover_url='storage:'||asset.path AND (p_manga_id IS NULL OR m.id<>work.id))
 AND NOT EXISTS(SELECT 1 FROM public.volumes v WHERE NOT(v.id=ANY(units)) AND (v.cover_url='storage:'||asset.path OR v.source_path=asset.path))
 AND NOT EXISTS(SELECT 1 FROM public.pages p WHERE NOT(p.volume_id=ANY(units)) AND p.storage_path=asset.path)
 ON CONFLICT DO NOTHING;

 IF p_manga_id IS NOT NULL THEN
   INSERT INTO public.content_removals(manga_id,manga_title,removed_by,reason,details)
   VALUES(work.id,work.title,me,CASE WHEN admin THEN COALESCE(nullif(btrim(p_reason),''),'creator_request') ELSE 'creator_request' END,nullif(btrim(p_details),''));
   UPDATE public.marketplace_listings
      SET active=false, manga_id=CASE WHEN manga_id=work.id THEN NULL ELSE manga_id END,
          manga_ids=array_remove(manga_ids,work.id), updated_at=now()
    WHERE manga_id=work.id OR work.id=ANY(manga_ids);
   DELETE FROM public.mangas WHERE id=work.id;
 ELSE
   DELETE FROM public.volumes WHERE id=p_volume_id;
 END IF;
 RETURN jsonb_build_object('ok',true);
END $delete$;
REVOKE ALL ON FUNCTION public.booksyde_delete_publication(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.booksyde_delete_publication(uuid,uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
