BEGIN;

-- Garante que volumes antigos com page_count = 0 do Drive podem ser atualizados
-- mesmo se o source_path for 'gdrive:...' em vez de 'gdrive:FILE_ID'
CREATE OR REPLACE FUNCTION public.booksyde_import_drive_volume(
 p_manga_id uuid,p_file_id text,p_name text,p_number integer,p_unit_kind text,p_page_count integer,p_size bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE existing public.volumes%ROWTYPE; w public.mangas%ROWTYPE;
BEGIN
 IF NOT public.can_manage_publication(p_manga_id) THEN RAISE EXCEPTION 'Sem permissão para importar nesta obra' USING ERRCODE='42501'; END IF;
 IF p_file_id IS NULL OR p_file_id !~ '^[a-zA-Z0-9_-]+$' OR p_number IS NULL OR p_number<0
    OR p_page_count IS NULL OR p_page_count<1 OR p_unit_kind IS NULL OR p_unit_kind NOT IN('volume','chapter')
    OR p_size IS NULL OR p_size<1 OR p_size>524288000 THEN RAISE EXCEPTION 'Dados do PDF inválidos'; END IF;
 -- Serialize imports of this work, including creation of a previously missing number.
 SELECT * INTO w FROM public.mangas WHERE id=p_manga_id FOR UPDATE;
 IF w.work_type='book' AND NOT w.is_collection AND (p_number<>1 OR p_unit_kind<>'volume') THEN RAISE EXCEPTION 'Livro individual aceita somente o volume 1'; END IF;
 SELECT * INTO existing FROM public.volumes WHERE manga_id=p_manga_id AND number=p_number FOR UPDATE;
 IF FOUND THEN
   -- Repair Drive PDFs with missing page counts.
   -- Accept if: same source OR (old-style Drive AND zero pages AND no processed pages)
   IF existing.file_format='pdf' AND (existing.source_name LIKE 'gdrive:%' OR existing.source_path LIKE 'gdrive:%')
      AND existing.page_count=0 AND NOT EXISTS(SELECT 1 FROM public.pages WHERE volume_id=existing.id) THEN
     UPDATE public.volumes SET page_count=p_page_count,source_size=p_size,
        source_name='gdrive:'||p_file_id,source_path='gdrive:'||p_file_id,
        title=COALESCE(NULLIF(title,''),regexp_replace(p_name,'\.pdf$','','i')),published=true WHERE id=existing.id;
     RETURN 'updated';
   END IF;
   -- Original check: exact same Drive file with zero pages.
   IF existing.source_name IS DISTINCT FROM 'gdrive:'||p_file_id OR existing.source_path IS DISTINCT FROM 'gdrive:'||p_file_id
      OR existing.page_count>0 OR EXISTS(SELECT 1 FROM public.pages WHERE volume_id=existing.id) THEN RETURN 'skipped'; END IF;
   UPDATE public.volumes SET page_count=p_page_count,source_size=p_size,file_format='pdf',
      title=COALESCE(NULLIF(title,''),regexp_replace(p_name,'\.pdf$','','i')),published=true WHERE id=existing.id;
   RETURN 'updated';
 END IF;
 INSERT INTO public.volumes(manga_id,number,unit_kind,page_count,published,source_name,source_path,source_type,source_size,file_format,title)
 VALUES(p_manga_id,p_number,p_unit_kind,p_page_count,true,'gdrive:'||p_file_id,'gdrive:'||p_file_id,'application/pdf',p_size,'pdf',regexp_replace(p_name,'\.pdf$','','i'));
 RETURN 'created';
END; $$;
REVOKE ALL ON FUNCTION public.booksyde_import_drive_volume(uuid,text,text,integer,text,integer,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booksyde_import_drive_volume(uuid,text,text,integer,text,integer,bigint) TO authenticated;

COMMIT;
