-- BookSyde: instala as RPCs server-only ausentes no histórico versionado.
-- Execute inteiro, após 01_cadastro_preferencias.sql, no SQL Editor como postgres.
-- Preserva RPCs já instaladas: implementações de produção precisam de diagnóstico
-- antes de serem substituídas. Não marca pedidos como pagos nem concede livros.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
DECLARE v_name text; v_missing text[] := '{}';
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'public.profiles', 'public.user_roles', 'public.mangas',
    'public.marketplace_sellers', 'public.marketplace_listings',
    'public.marketplace_orders', 'public.marketplace_order_items',
    'public.marketplace_delivery_codes', 'public.direct_messages',
    'public.purchases', 'public.manga_access'
  ] LOOP
    IF to_regclass(v_name) IS NULL THEN v_missing := array_append(v_missing, v_name); END IF;
  END LOOP;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'Faltam tabelas: %. Execute 00_diagnostico.sql; é necessário recuperar as migrações base.', array_to_string(v_missing, ', ');
  END IF;
  FOREACH v_name IN ARRAY ARRAY[
    'public.fulfill_marketplace_order(uuid,text)',
    'public.get_marketplace_order_details(uuid)',
    'public.redeem_marketplace_order(uuid)',
    'public.redeem_marketplace_code(text)'
  ] LOOP
    IF to_regprocedure(v_name) IS NULL THEN v_missing := array_append(v_missing, v_name); END IF;
  END LOOP;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'Faltam funções de entrega: %. Execute 00_diagnostico.sql antes de habilitar compras.', array_to_string(v_missing, ', ');
  END IF;
END $$;

-- Campo consultado pela página da obra, ausente nas migrações recuperadas.
-- Não altera preços nem ativa flags de venda dos registros existentes.
ALTER TABLE public.mangas ADD COLUMN IF NOT EXISTS catalog_sale_enabled boolean NOT NULL DEFAULT false;

-- Falha antes de instalar funções se faltarem colunas utilizadas pelo fluxo.
SELECT id, creator_id, visibility, distribution_channel, title, author, category,
       work_type, cover_url, price_cents, currency FROM public.mangas LIMIT 0;
SELECT user_id, stripe_sandbox_account_id, stripe_live_account_id,
       sandbox_charges_enabled, live_charges_enabled FROM public.marketplace_sellers LIMIT 0;
SELECT id, seller_id, active, target_type, title, author, category, work_type,
       cover_url, folder_color, manga_ids, price_cents, currency
FROM public.marketplace_listings LIMIT 0;
SELECT id, buyer_id, seller_id, status, total_cents, currency, stripe_environment,
       stripe_account_id, checkout_session_id, checkout_url, paid_at, created_at, updated_at
FROM public.marketplace_orders LIMIT 0;
SELECT id, order_id, listing_id, target_type, title, author, category, work_type,
       cover_url, folder_color, manga_ids, price_cents, currency, created_at
FROM public.marketplace_order_items LIMIT 0;
SELECT sender_id, receiver_id, body, message_kind, marketplace_order_id
FROM public.direct_messages LIMIT 0;

DO $install$
BEGIN
  IF to_regprocedure('public.create_catalog_order_server(uuid,uuid,text)') IS NULL THEN
    EXECUTE $ddl$
CREATE FUNCTION public.create_catalog_order_server(_buyer_id uuid, _manga_id uuid, _environment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
DECLARE
  v_manga public.mangas%ROWTYPE;
  v_order_id uuid;
BEGIN
  IF _environment IS NULL OR _environment NOT IN ('sandbox','live') THEN
    RAISE EXCEPTION 'Ambiente de pagamento inválido.';
  END IF;
  IF _buyer_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _buyer_id) THEN
    RAISE EXCEPTION 'Perfil do comprador não encontrado. Conclua o cadastro.';
  END IF;
  SELECT * INTO v_manga FROM public.mangas m WHERE m.id = _manga_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Obra não encontrada.'; END IF;
  IF v_manga.visibility IS DISTINCT FROM 'public'
     OR v_manga.distribution_channel IS DISTINCT FROM 'catalog'
     OR v_manga.price_cents IS NULL OR v_manga.price_cents < 100
     OR upper(v_manga.currency) IS DISTINCT FROM 'BRL' THEN
    RAISE EXCEPTION 'Esta obra não está disponível para compra direta no Catálogo.';
  END IF;
  -- O checkout atual cobra pela conta Stripe da plataforma apenas para admins.
  -- Não escolhe um admin arbitrário nem muda o proprietário da obra.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = v_manga.creator_id AND r.role::text = 'admin'
  ) THEN RAISE EXCEPTION 'A obra precisa ter um administrador responsável pela venda no Catálogo.'; END IF;
  IF v_manga.creator_id = _buyer_id THEN RAISE EXCEPTION 'Você não pode comprar sua própria obra.'; END IF;

  INSERT INTO public.marketplace_orders(buyer_id, seller_id, total_cents, currency, stripe_environment)
  VALUES (_buyer_id, v_manga.creator_id, v_manga.price_cents, 'BRL', _environment)
  RETURNING id INTO v_order_id;
  INSERT INTO public.marketplace_order_items(
    order_id, listing_id, target_type, title, author, category, work_type,
    cover_url, manga_ids, price_cents, currency
  ) VALUES (
    v_order_id, NULL, 'manga', v_manga.title, coalesce(v_manga.author,''),
    coalesce(v_manga.category,''), v_manga.work_type, v_manga.cover_url,
    ARRAY[v_manga.id], v_manga.price_cents, 'BRL'
  );
  INSERT INTO public.direct_messages(sender_id, receiver_id, body, message_kind, marketplace_order_id)
  VALUES (_buyer_id, v_manga.creator_id,
          'Pedido do Catálogo: ' || left(v_manga.title,150), 'marketplace_order', v_order_id);
  RETURN jsonb_build_object('order_id',v_order_id, 'seller_id',v_manga.creator_id,
    'total_cents',v_manga.price_cents, 'stripe_environment',_environment, 'uses_platform_stripe',true);
END $body$;
    $ddl$;
    ALTER FUNCTION public.create_catalog_order_server(uuid,uuid,text) OWNER TO postgres;
  ELSE
    RAISE NOTICE 'create_catalog_order_server já existe; implementação preservada.';
  END IF;
END $install$;

DO $install$
BEGIN
  IF to_regprocedure('public.create_marketplace_order_server(uuid,uuid[],text)') IS NULL THEN
    EXECUTE $ddl$
CREATE FUNCTION public.create_marketplace_order_server(_buyer_id uuid, _listing_ids uuid[], _environment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
DECLARE
  v_ids uuid[];
  v_seller uuid;
  v_total bigint;
  v_order_id uuid;
  v_count integer;
  v_platform boolean;
  v_account text;
BEGIN
  IF _environment IS NULL OR _environment NOT IN ('sandbox','live') THEN
    RAISE EXCEPTION 'Ambiente de pagamento inválido.';
  END IF;
  IF _buyer_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _buyer_id) THEN
    RAISE EXCEPTION 'Perfil do comprador não encontrado. Conclua o cadastro.';
  END IF;
  IF _listing_ids IS NULL OR cardinality(_listing_ids) NOT BETWEEN 1 AND 20
     OR array_position(_listing_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Selecione entre 1 e 20 itens válidos.';
  END IF;
  SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest(_listing_ids) x;
  -- Mantém preço e composição estáveis até concluir a transação.
  PERFORM l.id FROM public.marketplace_listings l
    WHERE l.id = ANY(v_ids) ORDER BY l.id FOR SHARE;
  SELECT count(*), (array_agg(l.seller_id ORDER BY l.id))[1], sum(l.price_cents)
    INTO v_count, v_seller, v_total
    FROM public.marketplace_listings l WHERE l.id = ANY(v_ids) AND l.active;
  IF v_count <> cardinality(v_ids) THEN RAISE EXCEPTION 'Um ou mais itens não estão disponíveis.'; END IF;
  IF EXISTS (SELECT 1 FROM public.marketplace_listings l WHERE l.id = ANY(v_ids) AND l.seller_id <> v_seller) THEN
    RAISE EXCEPTION 'Cada compra deve conter itens de apenas um vendedor.';
  END IF;
  IF v_seller = _buyer_id THEN RAISE EXCEPTION 'Você não pode comprar seus próprios arquivos.'; END IF;
  IF v_total IS NULL OR v_total NOT BETWEEN 1 AND 2147483647 OR EXISTS (
    SELECT 1 FROM public.marketplace_listings l WHERE l.id = ANY(v_ids)
      AND (l.price_cents IS NULL OR l.price_cents <= 0 OR l.currency IS DISTINCT FROM 'BRL'
           OR l.manga_ids IS NULL OR cardinality(l.manga_ids) = 0)
  ) THEN RAISE EXCEPTION 'Preço, moeda ou conteúdo do anúncio inválido.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.marketplace_listings l
    CROSS JOIN LATERAL unnest(l.manga_ids) AS ids(manga_id)
    LEFT JOIN public.mangas m ON m.id = ids.manga_id
    WHERE l.id = ANY(v_ids) AND (m.id IS NULL OR m.creator_id IS DISTINCT FROM v_seller)
  ) THEN RAISE EXCEPTION 'O anúncio contém obras que não pertencem ao vendedor.'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v_seller AND r.role::text = 'admin')
    INTO v_platform;
  IF NOT v_platform THEN
    SELECT CASE WHEN _environment = 'live' THEN s.stripe_live_account_id ELSE s.stripe_sandbox_account_id END
      INTO v_account FROM public.marketplace_sellers s
      WHERE s.user_id = v_seller AND CASE WHEN _environment = 'live' THEN s.live_charges_enabled ELSE s.sandbox_charges_enabled END;
    IF nullif(v_account,'') IS NULL THEN
      RAISE EXCEPTION 'O vendedor não está disponível para receber pagamentos neste ambiente.';
    END IF;
  END IF;
  INSERT INTO public.marketplace_orders(buyer_id, seller_id, total_cents, currency, stripe_environment, stripe_account_id)
  VALUES (_buyer_id, v_seller, v_total::integer, 'BRL', _environment, v_account)
  RETURNING id INTO v_order_id;
  INSERT INTO public.marketplace_order_items(
    order_id, listing_id, target_type, title, author, category, work_type,
    cover_url, folder_color, manga_ids, price_cents, currency
  ) SELECT v_order_id, l.id, l.target_type, l.title, l.author, l.category, l.work_type,
           l.cover_url, l.folder_color, l.manga_ids, l.price_cents, l.currency
    FROM public.marketplace_listings l WHERE l.id = ANY(v_ids) ORDER BY l.id;
  INSERT INTO public.direct_messages(sender_id, receiver_id, body, message_kind, marketplace_order_id)
  SELECT _buyer_id, v_seller,
    'Escolhi estes arquivos:' || E'\n\n' || string_agg('• ' || left(i.title,150), E'\n' ORDER BY i.title),
    'marketplace_order', v_order_id
  FROM public.marketplace_order_items i WHERE i.order_id = v_order_id;
  RETURN jsonb_build_object('order_id',v_order_id, 'seller_id',v_seller,
    'total_cents',v_total, 'stripe_environment',_environment, 'uses_platform_stripe',v_platform);
END $body$;
    $ddl$;
    ALTER FUNCTION public.create_marketplace_order_server(uuid,uuid[],text) OWNER TO postgres;
  ELSE
    RAISE NOTICE 'create_marketplace_order_server já existe; implementação preservada.';
  END IF;
END $install$;

-- A identidade do comprador vem da API autenticada, nunca de uma RPC pública.
REVOKE ALL ON FUNCTION public.create_catalog_order_server(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_marketplace_order_server(uuid,uuid[],text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fulfill_marketplace_order(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_catalog_order_server(uuid,uuid,text),
  public.create_marketplace_order_server(uuid,uuid[],text),
  public.fulfill_marketplace_order(uuid,text) TO service_role;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.user_roles, public.marketplace_order_items TO service_role;
GRANT SELECT, UPDATE ON public.marketplace_orders TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.marketplace_sellers TO service_role;

-- Repara leitura do pedido pelos participantes, sem permitir alterar pagamentos.
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_order_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.marketplace_orders, public.marketplace_order_items TO authenticated;
DROP POLICY IF EXISTS repair_orders_participant_read ON public.marketplace_orders;
CREATE POLICY repair_orders_participant_read ON public.marketplace_orders FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (buyer_id, seller_id));
DROP POLICY IF EXISTS repair_order_items_participant_read ON public.marketplace_order_items;
CREATE POLICY repair_order_items_participant_read ON public.marketplace_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.marketplace_orders o
    WHERE o.id = order_id AND (SELECT auth.uid()) IN (o.buyer_id, o.seller_id)));

NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'RPCs de compra verificadas/instaladas. A confirmação de pagamento continua dependendo do webhook Stripe.' AS resultado;
