-- BookSyde: corrige listagem pública do Marketplace.
-- Mantém anúncios ativos visíveis mesmo quando um perfil/seller ainda não foi completado.
BEGIN;

DROP VIEW IF EXISTS public.marketplace_catalog;
CREATE VIEW public.marketplace_catalog WITH (security_barrier=true) AS
 SELECT l.id,l.seller_id,
        coalesce(nullif(btrim(p.display_name),''),'Vendedor') AS seller_name,
        p.avatar_url AS seller_avatar_url,
        l.target_type,l.title,l.author,l.category,l.work_type,l.cover_url,l.price_cents,
        l.currency,l.created_at,l.manga_ids,
        coalesce(s.sandbox_charges_enabled,false) AS sandbox_charges_enabled,
        coalesce(s.live_charges_enabled,false) AS live_charges_enabled
 FROM public.marketplace_listings l
 LEFT JOIN public.profiles p ON p.id=l.seller_id
 LEFT JOIN public.marketplace_sellers s ON s.user_id=l.seller_id
 WHERE l.active=true;

DROP VIEW IF EXISTS public.marketplace_seller_stats;
CREATE VIEW public.marketplace_seller_stats WITH (security_barrier=true) AS
 SELECT p.id AS seller_id,p.display_name,p.avatar_url,p.created_at AS profile_created_at,
        coalesce(s.featured,false) AS featured,
        coalesce(s.sandbox_charges_enabled,false) AS sandbox_charges_enabled,
        coalesce(s.live_charges_enabled,false) AS live_charges_enabled,
        (SELECT count(*)::bigint FROM public.marketplace_listings l
          WHERE l.seller_id=p.id AND l.active) AS published_count,
        (SELECT count(*)::bigint FROM public.marketplace_orders o
          WHERE o.seller_id=p.id AND o.status='paid' AND o.stripe_environment='sandbox') AS sandbox_sales_count,
        (SELECT count(*)::bigint FROM public.marketplace_orders o
          WHERE o.seller_id=p.id AND o.status='paid' AND o.stripe_environment='live') AS live_sales_count
 FROM public.profiles p
 LEFT JOIN public.marketplace_sellers s ON s.user_id=p.id
 WHERE s.user_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.marketplace_listings l WHERE l.seller_id=p.id AND l.active);

GRANT SELECT ON public.marketplace_catalog,public.marketplace_seller_stats TO anon,authenticated;
COMMIT;
