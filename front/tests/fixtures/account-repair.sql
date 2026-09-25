-- Fixture de contrato derivada do histórico 6c63f4de^; somente banco descartável.
-- Auth é simulado. Stripe, HTTP e funções de entrega NÃO são simulados como sucesso.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='postgres') THEN CREATE ROLE postgres SUPERUSER; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role,supabase_auth_admin;
GRANT INSERT ON auth.users TO supabase_auth_admin;
-- roles
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Leitor',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "roles_read_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- profile auto-create
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1), 'Leitor'))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


ALTER TABLE profiles ADD COLUMN theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light'));
ALTER TABLE profiles ADD COLUMN book_display_style text NOT NULL DEFAULT 'grid' CHECK (book_display_style IN ('grid','book','showcase'));
CREATE TABLE public.mangas(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), creator_id uuid REFERENCES profiles(id),
  visibility text NOT NULL DEFAULT 'public', distribution_channel text NOT NULL DEFAULT 'catalog',
  title text NOT NULL, author text DEFAULT '', category text DEFAULT '', work_type text DEFAULT 'book',
  cover_url text, price_cents integer NOT NULL, currency text NOT NULL DEFAULT 'BRL'
);
CREATE TABLE public.library_folders(id uuid PRIMARY KEY);
CREATE TABLE public.direct_messages(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id uuid NOT NULL REFERENCES profiles(id),
  receiver_id uuid NOT NULL REFERENCES profiles(id), body text NOT NULL CHECK (length(body)<=4000),
  message_kind text NOT NULL, marketplace_order_id uuid
);
CREATE TABLE public.purchases(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.manga_access(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.marketplace_sellers (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_sandbox_account_id text UNIQUE,
  stripe_live_account_id text UNIQUE,
  sandbox_charges_enabled boolean NOT NULL DEFAULT false,
  sandbox_payouts_enabled boolean NOT NULL DEFAULT false,
  sandbox_details_submitted boolean NOT NULL DEFAULT false,
  live_charges_enabled boolean NOT NULL DEFAULT false,
  live_payouts_enabled boolean NOT NULL DEFAULT false,
  live_details_submitted boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('manga', 'folder')),
  manga_id uuid REFERENCES public.mangas(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.library_folders(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
  author text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  work_type text NOT NULL DEFAULT 'manga',
  cover_url text,
  folder_color text,
  manga_ids uuid[] NOT NULL DEFAULT '{}',
  price_cents integer NOT NULL CHECK (price_cents > 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (target_type = 'manga' AND manga_id IS NOT NULL AND folder_id IS NULL)
    OR
    (target_type = 'folder' AND folder_id IS NOT NULL AND manga_id IS NULL)
  ),
  CHECK (cardinality(manga_ids) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_listing_manga_unique
  ON public.marketplace_listings(seller_id, manga_id)
  WHERE target_type = 'manga';

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_listing_folder_unique
  ON public.marketplace_listings(seller_id, folder_id)
  WHERE target_type = 'folder';

CREATE INDEX IF NOT EXISTS marketplace_listings_active_idx
  ON public.marketplace_listings(active, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_listings_seller_idx
  ON public.marketplace_listings(seller_id, active, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketplace_wishlist (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'awaiting_payment', 'paid', 'expired', 'canceled', 'refunded')),
  total_cents integer NOT NULL CHECK (total_cents > 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  stripe_environment text NOT NULL CHECK (stripe_environment IN ('sandbox', 'live')),
  stripe_account_id text,
  checkout_session_id text,
  checkout_url text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_id <> seller_id)
);

CREATE INDEX IF NOT EXISTS marketplace_orders_buyer_idx
  ON public.marketplace_orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_orders_seller_idx
  ON public.marketplace_orders(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_orders_status_idx
  ON public.marketplace_orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketplace_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('manga', 'folder')),
  title text NOT NULL,
  author text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  work_type text NOT NULL DEFAULT 'manga',
  cover_url text,
  folder_color text,
  manga_ids uuid[] NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents > 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(manga_ids) > 0)
);

CREATE INDEX IF NOT EXISTS marketplace_order_items_order_idx
  ON public.marketplace_order_items(order_id, created_at);

CREATE TABLE IF NOT EXISTS public.marketplace_delivery_codes (
  code text PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL UNIQUE REFERENCES public.marketplace_order_items(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK (target_type IN ('manga', 'folder')),
  title text NOT NULL,
  folder_color text,
  manga_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  used_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CHECK (cardinality(manga_ids) > 0)
);

CREATE INDEX IF NOT EXISTS marketplace_delivery_order_idx
  ON public.marketplace_delivery_codes(order_id, created_at);

ALTER TABLE public.marketplace_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_delivery_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.marketplace_sellers FROM anon, authenticated;
REVOKE ALL ON public.marketplace_listings FROM anon, authenticated;
REVOKE ALL ON public.marketplace_wishlist FROM anon, authenticated;
REVOKE ALL ON public.marketplace_orders FROM anon, authenticated;
REVOKE ALL ON public.marketplace_order_items FROM anon, authenticated;
REVOKE ALL ON public.marketplace_delivery_codes FROM anon, authenticated;

GRANT SELECT ON public.marketplace_sellers TO authenticated;
GRANT SELECT ON public.marketplace_listings TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.marketplace_wishlist TO authenticated;
GRANT SELECT ON public.marketplace_orders, public.marketplace_order_items, public.marketplace_delivery_codes TO authenticated;
GRANT ALL ON public.marketplace_sellers, public.marketplace_listings, public.marketplace_wishlist,
  public.marketplace_orders, public.marketplace_order_items, public.marketplace_delivery_codes TO service_role;

DROP POLICY IF EXISTS marketplace_sellers_select_own ON public.marketplace_sellers;
CREATE POLICY marketplace_sellers_select_own
ON public.marketplace_sellers FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS marketplace_listings_public_read ON public.marketplace_listings;
CREATE POLICY marketplace_listings_public_read
ON public.marketplace_listings FOR SELECT TO anon, authenticated
USING (active OR seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS marketplace_wishlist_own_select ON public.marketplace_wishlist;
CREATE POLICY marketplace_wishlist_own_select
ON public.marketplace_wishlist FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS marketplace_wishlist_own_insert ON public.marketplace_wishlist;
CREATE POLICY marketplace_wishlist_own_insert
ON public.marketplace_wishlist FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.marketplace_listings l
    WHERE l.id = listing_id AND l.active
  )
);

DROP POLICY IF EXISTS marketplace_wishlist_own_delete ON public.marketplace_wishlist;
CREATE POLICY marketplace_wishlist_own_delete
ON public.marketplace_wishlist FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS marketplace_orders_participants_select ON public.marketplace_orders;
CREATE POLICY marketplace_orders_participants_select
ON public.marketplace_orders FOR SELECT TO authenticated
USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS marketplace_order_items_participants_select ON public.marketplace_order_items;
CREATE POLICY marketplace_order_items_participants_select
ON public.marketplace_order_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.marketplace_orders o
    WHERE o.id = order_id
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

DROP POLICY IF EXISTS marketplace_delivery_participants_select ON public.marketplace_delivery_codes;
CREATE POLICY marketplace_delivery_participants_select
ON public.marketplace_delivery_codes FOR SELECT TO authenticated
USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));


-- Somente assinaturas das dependências. Testar pagamento/entrega exige o banco real
-- e eventos Stripe; estes stubs falham caso sejam chamados.
CREATE FUNCTION public.fulfill_marketplace_order(_order_id uuid,_stripe_session_id text)
RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Delivery outside fixture scope'; END $$;
CREATE FUNCTION public.get_marketplace_order_details(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Delivery outside fixture scope'; END $$;
CREATE FUNCTION public.redeem_marketplace_order(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Delivery outside fixture scope'; END $$;
CREATE FUNCTION public.redeem_marketplace_code(_code text)
RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Delivery outside fixture scope'; END $$;
