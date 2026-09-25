-- Exclusão atômica com auditoria e limpeza de arquivos autorizada pelo banco.
BEGIN;
CREATE TABLE IF NOT EXISTS public.publication_cleanup (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 bucket_id text NOT NULL CHECK (bucket_id IN ('manga-pages','manga-covers','volume-sources')),
 object_path text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(requested_by,bucket_id,object_path)
);
ALTER TABLE public.publication_cleanup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.publication_cleanup FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.publication_cleanup TO authenticated;
GRANT ALL ON public.publication_cleanup TO service_role;
DROP POLICY IF EXISTS cleanup_owner ON public.publication_cleanup;
CREATE POLICY cleanup_owner ON public.publication_cleanup FOR ALL TO authenticated
 USING(requested_by=auth.uid()) WITH CHECK(false);

-- Após excluir a obra, a política normal perde sua referência. O recibo só pode
-- ser criado pela RPC abaixo e autoriza a limpeza dos caminhos exatos registrados.
DROP POLICY IF EXISTS booksyde_cleanup_read ON storage.objects;
CREATE POLICY booksyde_cleanup_read ON storage.objects FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.publication_cleanup c
 WHERE c.requested_by=auth.uid() AND c.bucket_id=objects.bucket_id AND c.object_path=objects.name));
DROP POLICY IF EXISTS booksyde_cleanup_delete ON storage.objects;
CREATE POLICY booksyde_cleanup_delete ON storage.objects FOR DELETE TO authenticated
 USING(EXISTS(SELECT 1 FROM public.publication_cleanup c
 WHERE c.requested_by=auth.uid() AND c.bucket_id=objects.bucket_id AND c.object_path=objects.name));

CREATE OR REPLACE FUNCTION public.booksyde_delete_publication(
 p_manga_id uuid DEFAULT NULL,p_volume_id uuid DEFAULT NULL,
 p_reason text DEFAULT NULL,p_details text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $delete$
DECLARE me uuid:=auth.uid(); work public.mangas%rowtype; units uuid[]; admin boolean;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Faça login.' USING ERRCODE='42501'; END IF;
 IF (p_manga_id IS NULL) = (p_volume_id IS NULL) THEN
   RAISE EXCEPTION 'Informe uma obra ou um volume.' USING ERRCODE='22023';
 END IF;
 SELECT m.* INTO work FROM public.mangas m
 WHERE m.id=COALESCE(p_manga_id,(SELECT v.manga_id FROM public.volumes v WHERE v.id=p_volume_id))
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Publicação não encontrada.' USING ERRCODE='P0002'; END IF;
 IF NOT public.can_manage_publication(work.id) THEN
   RAISE EXCEPTION 'Sem permissão para apagar esta publicação.' USING ERRCODE='42501';
 END IF;
 admin:=public.has_role(me,'admin');
 IF p_manga_id IS NOT NULL AND admin AND nullif(btrim(p_reason),'') IS NULL THEN
   RAISE EXCEPTION 'Informe o motivo da remoção.' USING ERRCODE='22023';
 END IF;
 -- Impede alteração simultânea dos metadados que serão removidos.
 PERFORM 1 FROM public.volumes v WHERE v.manga_id=work.id
   AND (p_volume_id IS NULL OR v.id=p_volume_id) FOR UPDATE;
 SELECT COALESCE(array_agg(v.id),ARRAY[]::uuid[]) INTO units FROM public.volumes v
 WHERE v.manga_id=work.id AND (p_volume_id IS NULL OR v.id=p_volume_id);
 IF p_volume_id IS NOT NULL AND cardinality(units)=0 THEN
   RAISE EXCEPTION 'Publicação não encontrada.' USING ERRCODE='P0002';
 END IF;

 INSERT INTO public.publication_cleanup(requested_by,bucket_id,object_path)
 SELECT DISTINCT me,asset.bucket,asset.path FROM (
   SELECT 'manga-pages' AS bucket,p.storage_path AS path FROM public.pages p WHERE p.volume_id=ANY(units)
   UNION ALL SELECT 'volume-sources',v.source_path FROM public.volumes v WHERE v.id=ANY(units)
   UNION ALL SELECT 'manga-covers',substr(v.cover_url,9) FROM public.volumes v WHERE v.id=ANY(units) AND v.cover_url LIKE 'storage:%'
   UNION ALL SELECT 'manga-covers',substr(work.cover_url,9) WHERE p_manga_id IS NOT NULL AND work.cover_url LIKE 'storage:%'
   UNION ALL SELECT 'manga-covers',work.id::text||'/'||v::text||'-preview-page-10.png' FROM unnest(units) v
 ) asset
 WHERE asset.path IS NOT NULL AND (
   split_part(asset.path,'/',1)=work.id::text
   OR (asset.bucket='manga-covers' AND split_part(asset.path,'/',1)=work.creator_id::text)
 )
 AND NOT EXISTS(SELECT 1 FROM public.mangas m WHERE m.cover_url='storage:'||asset.path
   AND (p_manga_id IS NULL OR m.id<>work.id))
 AND NOT EXISTS(SELECT 1 FROM public.volumes v WHERE NOT(v.id=ANY(units))
   AND (v.cover_url='storage:'||asset.path OR v.source_path=asset.path))
 AND NOT EXISTS(SELECT 1 FROM public.pages p WHERE NOT(p.volume_id=ANY(units)) AND p.storage_path=asset.path)
 ON CONFLICT DO NOTHING;

 IF p_manga_id IS NOT NULL THEN
   INSERT INTO public.content_removals(manga_id,manga_title,removed_by,reason,details)
   VALUES(work.id,work.title,me,CASE WHEN admin THEN btrim(p_reason) ELSE 'creator_request' END,nullif(btrim(p_details),''));
   UPDATE public.marketplace_listings SET active=false WHERE work.id=ANY(manga_ids);
   DELETE FROM public.mangas WHERE id=work.id;
 ELSE
   DELETE FROM public.volumes WHERE id=p_volume_id;
 END IF;
 RETURN jsonb_build_object('ok',true);
END $delete$;
REVOKE ALL ON FUNCTION public.booksyde_delete_publication(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.booksyde_delete_publication(uuid,uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
