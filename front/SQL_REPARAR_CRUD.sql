-- BookSyde: executar INTEIRO no SQL Editor do MESMO projeto do login, como postgres.
-- Requer o esquema principal e as migrações de estante física. Não apaga dados.
BEGIN;

-- Fonte: supabase/migrations/20260921230000_search_and_physical_shelf_access.sql
-- BookSyde: corrige busca de leitores e grants da estante física.
-- Aplicar após o schema completo e as migrações da estante física.
-- Não libera convites ou arquivos de obras; não modifica dados existentes.
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

-- Fonte: supabase/migrations/20260922010000_admin_types_publication_guards.sql
-- BookSyde · correção de tipo de conta + proteção de publicação.
-- Execute este arquivo UMA VEZ no SQL Editor do MESMO projeto do login.
-- Idempotente: as funções são substituídas e as políticas nomeadas são recriadas.
-- Requer o esquema principal BookSyde e a função public.is_creator já instalados.

-- BookSyde: alterar tipo da conta pelo cliente autenticado sem service_role.
-- Execute NO MESMO projeto Supabase do login, no SQL Editor.
-- Não modifica usuários existentes ao instalar. RLS permanece ativo.
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

-- BookSyde: protege criação/edição de obras após mudança de tipo da conta.
-- Rodar no mesmo projeto Supabase do login após a instalação do esquema principal.
-- Não concede leitura de livros nem desativa RLS. Não modifica linhas existentes.

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
    AND EXISTS (
      SELECT 1 FROM public.mangas m
      WHERE m.id = _manga_id
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR (public.is_creator(auth.uid()) AND m.creator_id = auth.uid())
        )
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

-- Fonte: supabase/migrations/20260922020000_private_work_fields.sql
-- BookSyde | Correção: permission denied for table mangas ao criar obra.
-- SQL Editor do MESMO projeto Supabase do login. Idempotente.
-- Mantém os campos privados fora do SELECT direto de authenticated.

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
NOTIFY pgrst, 'reload schema';

-- Fonte: supabase/migrations/20260922030000_crud_permissions.sql
-- BookSyde: reparo incremental de permissões. Aplicar como postgres.
-- Não remove dados, não altera papéis de usuários e mantém RLS ativo.
SET LOCAL lock_timeout = '10s';

-- Recusa permissões de escrita em tabelas sem as políticas de isolamento.
DO $guard$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','profile_contacts','mangas','volumes','pages',
 'bookmark_collections','page_bookmarks','reading_progress','reading_time_daily',
 'manga_favorites','marketplace_wishlist','library_folders','friendships',
 'comments','reviews','literary_places','literary_place_reviews','literary_place_confirmations',
 'physical_shelf_books','site_settings','marketplace_listings','marketplace_sellers'] LOOP
   IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t AND c.relrowsecurity)
      OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t) THEN
     RAISE EXCEPTION 'Tabela % sem RLS/políticas. Instale as migrações anteriores antes do reparo.',t;
   END IF;
 END LOOP;
END $guard$;

GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
GRANT SELECT ON public.marketplace_catalog,public.marketplace_seller_stats TO anon,authenticated;
GRANT SELECT ON public.literary_places,
 public.literary_place_reviews,public.literary_place_confirmations,public.reviews,
 public.marketplace_listings,public.site_settings TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.profiles,public.profile_contacts,
 public.bookmark_collections,public.page_bookmarks,public.reading_progress,public.reading_time_daily,
 public.manga_favorites,public.marketplace_wishlist,public.library_folders,
 public.friendships,
 public.comments,public.reviews,public.literary_places,public.literary_place_reviews,
 public.literary_place_confirmations TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.mangas,public.volumes,public.pages TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.marketplace_listings TO authenticated;
GRANT INSERT ON public.marketplace_sellers TO authenticated;
GRANT SELECT ON public.library_items,public.direct_messages TO authenticated;
GRANT SELECT ON public.user_roles,public.manga_access,public.marketplace_order_items,public.marketplace_delivery_codes,
 public.friend_share_codes,public.library_share_codes,public.content_removals,
 public.marketplace_reports,public.marketplace_refund_requests,public.support_requests,
 public.demo_accounts,public.demo_dashboard,public.demo_dashboard_access,
 public.demo_dashboard_countries,public.demo_dashboard_revenue,
 public.system_access_daily,public.system_access_state TO authenticated;
GRANT INSERT,UPDATE ON public.site_settings TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.demo_accounts,public.demo_dashboard,public.demo_dashboard_access,
 public.demo_dashboard_countries,public.demo_dashboard_revenue TO authenticated;

-- Supabase service_role tem BYPASSRLS; nunca disponibilizar chave service_role no browser.

GRANT SELECT,INSERT,UPDATE,DELETE ON public.physical_shelf_books TO authenticated,service_role;
REVOKE SELECT ON public.mangas,public.volumes,public.pages FROM anon,authenticated;
GRANT SELECT (id,author,category,catalog_sale_enabled,cover_url,created_at,creator_id,currency,description,
 genres,is_collection,price_cents,slug,status,synopsis,title,view_count,visibility,work_type,distribution_channel)
 ON public.mangas TO anon,authenticated;
GRANT SELECT (id,cover_url,created_at,file_format,manga_id,number,page_count,published,title,unit_kind)
 ON public.volumes TO anon,authenticated;
-- Caminhos internos só são retornados pela RPC após validar acesso e publicação.
GRANT SELECT (id,created_at,page_index,volume_id) ON public.pages TO anon,authenticated;

REVOKE SELECT ON public.marketplace_orders FROM authenticated;
GRANT SELECT (id,buyer_id,created_at,currency,paid_at,seller_id,status,total_cents,updated_at,fulfillment_status,stripe_environment)
 ON public.marketplace_orders TO authenticated;
REVOKE SELECT ON public.purchases FROM authenticated;
GRANT SELECT (id,user_id,manga_id,amount_cents,provider,status,created_at) ON public.purchases TO authenticated;
REVOKE SELECT ON public.subscriptions FROM authenticated;
GRANT SELECT (id,user_id,plan_code,provider,status,environment,current_period_end,created_at,updated_at)
 ON public.subscriptions TO authenticated;
REVOKE SELECT ON public.marketplace_sellers FROM anon,authenticated;
GRANT SELECT (user_id,created_at,updated_at,featured,store_bio,suspended_at,suspension_reason,
 sandbox_charges_enabled,sandbox_payouts_enabled,sandbox_details_submitted,
 live_charges_enabled,live_payouts_enabled,live_details_submitted)
 ON public.marketplace_sellers TO anon,authenticated;

-- Políticas públicas também invocam helpers; revogar EXECUTE impede a consulta inteira.
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role),
 public.can_access_manga(uuid,uuid), public.is_free_sample_path(text) TO anon;
GRANT EXECUTE ON FUNCTION
 public.has_role(uuid,public.app_role), public.is_creator(uuid),
 public.can_access_manga(uuid,uuid), public.can_marketplace_chat(uuid,uuid),
 public.is_free_sample_path(text),public.can_read_page_path(text,uuid),
 public.can_manage_publication(uuid),public.can_manage_publication_volume(uuid),
 public.can_manage_publication_object(text,text),
 public.search_readers(text,integer),public.get_reader_profiles(uuid[]),
 public.send_friend_request(uuid),public.respond_friend_request(uuid,boolean),
 public.send_direct_message(uuid,text,uuid,uuid,uuid,text,text,text),
 public.mark_direct_messages_read(uuid), public.get_library_workspace(),
 public.save_library_folder(text,uuid[],text,uuid),
 public.redeem_library_share(text,boolean,text,text),public.redeem_library_share(text,boolean),
 public.generate_library_share(uuid),public.share_code_with_friend(uuid,text,text,text,uuid,uuid,uuid,uuid,text),
 public.redeem_friend_share_code(text),public.redeem_manga_invite(text),
 public.add_reading_time(integer,uuid),public.record_system_access(),
 public.increment_manga_view(uuid), public.format_brl(integer),
 public.upsert_marketplace_listing(text,uuid,integer), public.set_marketplace_listing_active(uuid,boolean),
 public.update_marketplace_seller_profile(text),
 public.get_similar_marketplace_listings(uuid,integer),
 public.create_marketplace_order(uuid[],text),
 public.redeem_marketplace_code(text),public.redeem_marketplace_order(uuid),
 public.get_marketplace_order_details(uuid),public.get_admin_dashboard(integer),
 public.report_marketplace_listing(uuid,text,text),public.request_marketplace_refund(uuid,text,text),
 public.admin_set_marketplace_seller_featured(uuid,boolean),
 public.admin_set_marketplace_seller_suspension(uuid,boolean,text),
 public.admin_set_marketplace_listing_status(uuid,text,text),
 public.admin_review_marketplace_report(uuid,text,text),
 public.admin_review_marketplace_refund(uuid,text,text),
 public.admin_review_support_request(uuid,text),
 public.create_support_request(text,text,text,text,text)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_catalog_page(integer,timestamptz,uuid,text,text),
 public.get_reader_manifest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_catalog_page(integer,timestamptz,uuid,text,text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_support_request(text,text,text,text,text),
 public.increment_manga_view(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.create_catalog_order_server(uuid,uuid,text),
 public.create_marketplace_order_server(uuid,uuid[],text),
 public.fulfill_marketplace_order(uuid,text) TO service_role;

-- Mantém campos internos fora do SELECT geral. Apenas páginas efetivamente
-- autorizadas são retornadas; o Storage ainda valida cada URL assinada.
CREATE OR REPLACE FUNCTION public.booksyde_reader_pages(p_volume_ids uuid[], p_page_index integer DEFAULT NULL)
RETURNS TABLE(id uuid,volume_id uuid,page_index integer,storage_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $reader$
 SELECT p.id,p.volume_id,p.page_index,p.storage_path
 FROM public.pages p JOIN public.volumes v ON v.id=p.volume_id
 WHERE v.id=ANY(COALESCE(p_volume_ids,ARRAY[]::uuid[]))
   AND (p_page_index IS NULL OR p.page_index=p_page_index)
   AND (public.can_manage_publication(v.manga_id)
        OR (v.published AND public.can_access_manga(auth.uid(),v.manga_id)))
 ORDER BY p.volume_id,p.page_index;
$reader$;
REVOKE ALL ON FUNCTION public.booksyde_reader_pages(uuid[],integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booksyde_reader_pages(uuid[],integer) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.booksyde_reader_source(p_volume_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $source$
 SELECT v.source_path FROM public.volumes v WHERE v.id=p_volume_id AND v.file_format='epub'
 AND (public.can_manage_publication(v.manga_id)
      OR (v.published AND public.can_access_manga(auth.uid(),v.manga_id)));
$source$;
REVOKE ALL ON FUNCTION public.booksyde_reader_source(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booksyde_reader_source(uuid) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.booksyde_reader_preview(p_volume_id uuid)
RETURNS TABLE(bucket_id text,object_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $preview$
 SELECT CASE WHEN v.file_format='epub' THEN 'manga-covers' ELSE 'manga-pages' END,
 CASE WHEN v.file_format='epub' THEN m.id::text||'/'||v.id::text||'-preview-page-10.png'
      ELSE p.storage_path END
 FROM public.volumes v JOIN public.mangas m ON m.id=v.manga_id
 LEFT JOIN public.pages p ON p.volume_id=v.id AND p.page_index=9
 WHERE v.id=p_volume_id AND (public.can_manage_publication(m.id)
 OR (v.published AND (public.can_access_manga(auth.uid(),m.id)
     OR (m.visibility='public' AND m.distribution_channel IN ('catalog','marketplace')))));
$preview$;
REVOKE ALL ON FUNCTION public.booksyde_reader_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booksyde_reader_preview(uuid) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.can_read_page_path(_path text,_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $path$
 SELECT public.is_free_sample_path(_path) OR EXISTS (
  SELECT 1 FROM public.volumes v WHERE
   (v.source_path=_path OR EXISTS(SELECT 1 FROM public.pages p WHERE p.volume_id=v.id AND p.storage_path=_path))
   AND (public.can_manage_publication(v.manga_id)
     OR (v.published AND public.can_access_manga(_user_id,v.manga_id)))
 );
$path$;
GRANT EXECUTE ON FUNCTION public.can_read_page_path(text,uuid) TO anon,authenticated;
DROP POLICY IF EXISTS booksyde_public_reader_storage ON storage.objects;
CREATE POLICY booksyde_public_reader_storage ON storage.objects FOR SELECT TO anon
 USING(bucket_id IN ('manga-pages','volume-sources') AND public.can_read_page_path(name,NULL));

NOTIFY pgrst,'reload schema';

-- Fonte: supabase/migrations/20260922040000_publication_delete.sql
-- Exclusão atômica com auditoria e limpeza de arquivos autorizada pelo banco.
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
