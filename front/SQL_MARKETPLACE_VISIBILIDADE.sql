-- Execute no Supabase SQL Editor se o Marketplace continuar vazio.
BEGIN;
DROP VIEW IF EXISTS public.marketplace_catalog;
CREATE VIEW public.marketplace_catalog WITH (security_invoker=true) AS
SELECT l.id,l.seller_id,
       'Vendedor BookSyde'::text AS seller_name,
       NULL::text AS seller_avatar_url,
       l.target_type,l.title,l.author,l.category,l.work_type,l.cover_url,l.price_cents,
       l.currency,l.created_at,l.manga_ids,
       COALESCE(s.sandbox_charges_enabled,false) AS sandbox_charges_enabled,
       COALESCE(s.live_charges_enabled,false) AS live_charges_enabled
FROM public.marketplace_listings l
LEFT JOIN public.marketplace_sellers s ON s.user_id=l.seller_id
WHERE l.active=true;
GRANT SELECT ON public.marketplace_catalog TO anon,authenticated;
COMMIT;
