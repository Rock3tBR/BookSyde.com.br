-- BookSyde: corrige busca de leitores e grants da estante física.
-- Aplicar após o schema completo e as migrações da estante física.
-- Não libera convites ou arquivos de obras; não modifica dados existentes.
BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.search_readers(_query text,_max_results integer DEFAULT 12)
RETURNS TABLE(id uuid,display_name text,avatar_url text,user_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_user uuid:=auth.uid();
 v_query text:=left(trim(regexp_replace(coalesce(_query,''),'^\s*#\s*','')),64);
 v_like text;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'É necessário entrar na conta para buscar leitores' USING errcode='42501'; END IF;
 IF char_length(v_query)<2 THEN RETURN; END IF;
 v_like := '%' || replace(replace(replace(lower(v_query),'!','!!'),'%','!%'),'_','!_') || '%';
 RETURN QUERY
 SELECT p.id,p.display_name::text,p.avatar_url::text,p.user_code::text
 FROM public.profiles p
 WHERE p.id<>v_user AND (
   lower(coalesce(p.user_code,''))=lower(v_query)
   OR lower(p.display_name) LIKE v_like ESCAPE '!'
 )
 ORDER BY CASE WHEN lower(coalesce(p.user_code,''))=lower(v_query) THEN 0
               WHEN lower(p.display_name)=lower(v_query) THEN 1 ELSE 2 END,
          p.display_name,p.id
 LIMIT greatest(1,least(coalesce(_max_results,12),12));
END $$;
REVOKE ALL ON FUNCTION public.search_readers(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_readers(text,integer) TO authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.physical_shelf_books TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.physical_shelf_books TO service_role;
ALTER TABLE public.physical_shelf_books ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
COMMIT;
