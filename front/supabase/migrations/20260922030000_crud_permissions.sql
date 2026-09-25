-- BookSyde: reparo incremental de permissões. Aplicar como postgres.
-- Não remove dados, não altera papéis de usuários e mantém RLS ativo.
BEGIN;
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
COMMIT;
