-- BOOKSYDE | INSTALAÇÃO RECONSTRUÍDA PARA PROJETO SUPABASE NOVO | v3 IF NOT EXISTS
-- Fonte: tipos TypeScript e migrações incrementais do ZIP fornecido em 21/09/2026.
-- ATENÇÃO: as migrações INICIAIS originais não estão no ZIP. Isto NÃO é backup
-- nem restauração 1:1; revise fluxos de produção antes de comercializar.
-- Executar INTEIRO no SQL Editor de um projeto NOVO, como postgres.
-- Não apaga nem recria auth.users, storage.objects, contas, dados ou arquivos.
-- Se public.profiles já existir, interrompe para não alterar banco preexistente.
-- Serviços externos (Stripe webhooks, env/secrets, Auth URL, Storage uploads)
-- precisam ser configurados separadamente. Pedidos NUNCA são pagos pelo cliente.
BEGIN;
SET LOCAL search_path = public, extensions, pg_temp;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
DO $$ BEGIN
 IF to_regclass('public.profiles') IS NOT NULL THEN
  RAISE EXCEPTION 'Instalação apenas em banco NOVO. public.profiles já existe: abortando sem modificar dados.';
 END IF;
END $$;
DO $booksyde_app_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin','user','creator','editora');
  END IF;
END
$booksyde_app_role$;

-- 01 / TABELAS (35 entidades reconstruídas da tipagem)
CREATE TABLE IF NOT EXISTS public.bookmark_collections (
  created_at timestamptz DEFAULT now() NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.comments (
  body text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  manga_id uuid NOT NULL,
  user_id uuid NOT NULL,
  volume_id uuid,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.content_removals (
  created_at timestamptz DEFAULT now() NOT NULL,
  details text,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  manga_id uuid NOT NULL,
  manga_title text NOT NULL,
  page_paths text[] DEFAULT '{}'::text[] NOT NULL,
  reason text,
  removed_by uuid,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.direct_messages (
  body text DEFAULT '' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  manga_id uuid,
  marketplace_order_id uuid,
  message_kind text DEFAULT 'text' NOT NULL,
  page_id uuid,
  read_at timestamptz,
  receiver_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  share_code text,
  share_path text,
  share_title text,
  share_type text,
  volume_id uuid,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.friend_share_codes (
  code text DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,
  folder_color text,
  folder_id uuid,
  folder_name text,
  manga_id uuid,
  manga_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  page_id uuid,
  recipient_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  share_path text,
  share_type text NOT NULL,
  title text NOT NULL,
  used_at timestamptz,
  used_by uuid,
  volume_id uuid,
  PRIMARY KEY (code)
);
CREATE TABLE IF NOT EXISTS public.friendships (
  addressee_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  requester_id uuid NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.library_folders (
  color text DEFAULT '#1E40AF' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  creator_id uuid,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  owner_id uuid NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.library_items (
  folder_id uuid,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  manga_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  position integer DEFAULT 0 NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.library_share_codes (
  code text DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)) NOT NULL,
  creator_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  folder_id uuid NOT NULL,
  folder_name text NOT NULL,
  manga_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  used_at timestamptz,
  used_by uuid,
  PRIMARY KEY (code)
);
CREATE TABLE IF NOT EXISTS public.literary_place_confirmations (
  created_at timestamptz DEFAULT now() NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  place_id uuid NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.literary_place_reviews (
  body text DEFAULT '' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  place_id uuid NOT NULL,
  rating integer NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.literary_places (
  address text NOT NULL,
  categories text[] DEFAULT '{}'::text[] NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid NOT NULL,
  description text DEFAULT '' NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  instagram_url text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  name text NOT NULL,
  phone text,
  photo_url text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  website_url text,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.manga_access (
  created_at timestamptz DEFAULT now() NOT NULL,
  granted_by uuid,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  manga_id uuid NOT NULL,
  note text,
  updated_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.manga_favorites (
  created_at timestamptz DEFAULT now() NOT NULL,
  manga_id uuid NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (user_id, manga_id)
);
CREATE TABLE IF NOT EXISTS public.mangas (
  author text DEFAULT '' NOT NULL,
  category text DEFAULT '' NOT NULL,
  catalog_sale_enabled boolean DEFAULT false NOT NULL,
  cover_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  creator_id uuid,
  currency text DEFAULT 'BRL' NOT NULL,
  description text DEFAULT '' NOT NULL,
  distribution_channel text DEFAULT 'unlisted' NOT NULL,
  genres text[] DEFAULT '{}'::text[] NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  invite_token text DEFAULT encode(gen_random_bytes(16), 'hex') NOT NULL,
  is_collection boolean DEFAULT false NOT NULL,
  licensed_purchase_url text,
  licensed_store_name text,
  price_cents integer DEFAULT 0 NOT NULL,
  rights_basis text,
  rights_confirmed_at timestamptz,
  slug text NOT NULL,
  status text DEFAULT 'ongoing' NOT NULL,
  synopsis text DEFAULT '' NOT NULL,
  terms_accepted_at timestamptz,
  terms_version text,
  title text NOT NULL,
  view_count integer DEFAULT 0 NOT NULL,
  visibility text DEFAULT 'private' NOT NULL,
  work_type text NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.marketplace_delivery_codes (
  buyer_id uuid NOT NULL,
  code text DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  folder_color text,
  manga_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  order_id uuid NOT NULL,
  order_item_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  target_type text NOT NULL,
  title text NOT NULL,
  used_at timestamptz,
  used_by uuid,
  PRIMARY KEY (code)
);
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  active boolean DEFAULT false NOT NULL,
  author text DEFAULT '' NOT NULL,
  category text DEFAULT '' NOT NULL,
  cover_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  currency text DEFAULT 'BRL' NOT NULL,
  folder_color text,
  folder_id uuid,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  manga_id uuid,
  manga_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  price_cents integer DEFAULT 0 NOT NULL,
  seller_id uuid NOT NULL,
  target_type text NOT NULL,
  title text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  work_type text DEFAULT 'book' NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.marketplace_order_items (
  author text DEFAULT '' NOT NULL,
  category text DEFAULT '' NOT NULL,
  cover_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  currency text DEFAULT 'BRL' NOT NULL,
  folder_color text,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  listing_id uuid,
  manga_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  order_id uuid NOT NULL,
  price_cents integer DEFAULT 0 NOT NULL,
  target_type text NOT NULL,
  title text NOT NULL,
  work_type text DEFAULT 'book' NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  buyer_id uuid NOT NULL,
  checkout_session_id text,
  checkout_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  currency text DEFAULT 'BRL' NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  paid_at timestamptz,
  seller_id uuid NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  stripe_account_id text,
  stripe_environment text NOT NULL,
  total_cents integer NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.marketplace_sellers (
  created_at timestamptz DEFAULT now() NOT NULL,
  featured boolean DEFAULT false NOT NULL,
  live_charges_enabled boolean DEFAULT false NOT NULL,
  live_details_submitted boolean DEFAULT false NOT NULL,
  live_payouts_enabled boolean DEFAULT false NOT NULL,
  sandbox_charges_enabled boolean DEFAULT false NOT NULL,
  sandbox_details_submitted boolean DEFAULT false NOT NULL,
  sandbox_payouts_enabled boolean DEFAULT false NOT NULL,
  stripe_live_account_id text,
  stripe_sandbox_account_id text,
  updated_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (user_id)
);
CREATE TABLE IF NOT EXISTS public.marketplace_wishlist (
  created_at timestamptz DEFAULT now() NOT NULL,
  listing_id uuid NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (user_id, listing_id)
);
CREATE TABLE IF NOT EXISTS public.page_bookmarks (
  collection_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  page_index integer DEFAULT 0 NOT NULL,
  user_id uuid NOT NULL,
  volume_id uuid NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.pages (
  created_at timestamptz DEFAULT now() NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  page_index integer DEFAULT 0 NOT NULL,
  storage_path text NOT NULL,
  volume_id uuid NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.profile_contacts (
  user_id uuid NOT NULL,
  phone_e164 text,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id)
);
CREATE TABLE IF NOT EXISTS public.profiles (
  auto_next_volume boolean DEFAULT true NOT NULL,
  avatar_url text,
  book_display_style text DEFAULT 'grid' NOT NULL,
  continue_reading_preview text DEFAULT 'cover' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  data_saver boolean DEFAULT false NOT NULL,
  display_name text DEFAULT 'Leitor' NOT NULL,
  gibi_display_style text DEFAULT 'grid' NOT NULL,
  hide_reader_comments boolean DEFAULT false NOT NULL,
  hq_display_style text DEFAULT 'grid' NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  manga_display_style text DEFAULT 'grid' NOT NULL,
  page_transition text DEFAULT 'page_turn' NOT NULL,
  page_turn_speed text DEFAULT 'normal' NOT NULL,
  progress_style text DEFAULT 'full' NOT NULL,
  reader_background text DEFAULT 'black' NOT NULL,
  reader_brightness integer DEFAULT 100 NOT NULL,
  reader_onboarding_completed boolean DEFAULT false NOT NULL,
  reading_direction text DEFAULT 'manga' NOT NULL,
  show_progress boolean DEFAULT true NOT NULL,
  site_onboarding_completed boolean DEFAULT false NOT NULL,
  theme text DEFAULT 'dark' NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  user_code text,
  visible_work_types text[] DEFAULT ARRAY['manga','hq','gibi','book']::text[] NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.purchases (
  amount_cents integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  manga_id uuid NOT NULL,
  provider text DEFAULT 'stripe' NOT NULL,
  provider_ref text,
  status text DEFAULT 'pending' NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.reading_progress (
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  page_index integer DEFAULT 0 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid NOT NULL,
  volume_id uuid NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.reading_time_daily (
  created_at timestamptz DEFAULT now() NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  reading_date date DEFAULT current_date NOT NULL,
  seconds_read integer DEFAULT 0 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid NOT NULL,
  volume_id uuid NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.reviews (
  body text DEFAULT '' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  manga_id uuid NOT NULL,
  rating integer NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.site_settings (
  created_at timestamptz DEFAULT now() NOT NULL,
  key text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  value jsonb DEFAULT '{}'::jsonb NOT NULL,
  PRIMARY KEY (key)
);
CREATE TABLE IF NOT EXISTS public.subscriptions (
  created_at timestamptz DEFAULT now() NOT NULL,
  current_period_end timestamptz,
  environment text DEFAULT 'sandbox' NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  plan_code text NOT NULL,
  price_id text,
  provider text DEFAULT 'stripe' NOT NULL,
  provider_ref text DEFAULT '' NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  stripe_customer_id text,
  updated_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.system_access_daily (
  day date DEFAULT current_date NOT NULL,
  sessions integer DEFAULT 0 NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS public.system_access_state (
  last_seen timestamptz DEFAULT now() NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (user_id)
);
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  role public.app_role NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.volumes (
  cover_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  file_format text DEFAULT 'images' NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  manga_id uuid NOT NULL,
  number integer DEFAULT 1 NOT NULL,
  page_count integer DEFAULT 0 NOT NULL,
  published boolean DEFAULT false NOT NULL,
  source_name text,
  source_path text,
  source_size bigint,
  source_type text,
  title text DEFAULT '' NOT NULL,
  unit_kind text DEFAULT 'volume' NOT NULL,
  PRIMARY KEY (id)
);

-- 02 / CHAVES E RESTRIÇÕES
ALTER TABLE public.comments ADD CONSTRAINT comments_manga_id_fkey FOREIGN KEY (manga_id) REFERENCES public.mangas(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD CONSTRAINT comments_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(id) ON DELETE SET NULL;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_manga_id_fkey FOREIGN KEY (manga_id) REFERENCES public.mangas(id) ON DELETE SET NULL;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_marketplace_order_id_fkey FOREIGN KEY (marketplace_order_id) REFERENCES public.marketplace_orders(id) ON DELETE SET NULL;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE SET NULL;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(id) ON DELETE SET NULL;
ALTER TABLE public.friend_share_codes ADD CONSTRAINT friend_share_codes_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.library_folders(id) ON DELETE SET NULL;
ALTER TABLE public.friend_share_codes ADD CONSTRAINT friend_share_codes_manga_id_fkey FOREIGN KEY (manga_id) REFERENCES public.mangas(id) ON DELETE SET NULL;
ALTER TABLE public.friend_share_codes ADD CONSTRAINT friend_share_codes_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE SET NULL;
ALTER TABLE public.friend_share_codes ADD CONSTRAINT friend_share_codes_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.friend_share_codes ADD CONSTRAINT friend_share_codes_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.friend_share_codes ADD CONSTRAINT friend_share_codes_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.friend_share_codes ADD CONSTRAINT friend_share_codes_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(id) ON DELETE SET NULL;
ALTER TABLE public.friendships ADD CONSTRAINT friendships_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.friendships ADD CONSTRAINT friendships_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.library_items ADD CONSTRAINT library_items_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.library_folders(id) ON DELETE SET NULL;
ALTER TABLE public.library_items ADD CONSTRAINT library_items_manga_id_fkey FOREIGN KEY (manga_id) REFERENCES public.mangas(id) ON DELETE CASCADE;
ALTER TABLE public.library_share_codes ADD CONSTRAINT library_share_codes_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.library_folders(id) ON DELETE CASCADE;
ALTER TABLE public.literary_place_confirmations ADD CONSTRAINT literary_place_confirmations_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.literary_places(id) ON DELETE CASCADE;
ALTER TABLE public.literary_place_confirmations ADD CONSTRAINT literary_place_confirmations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.literary_place_reviews ADD CONSTRAINT literary_place_reviews_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.literary_places(id) ON DELETE CASCADE;
ALTER TABLE public.literary_place_reviews ADD CONSTRAINT literary_place_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.literary_places ADD CONSTRAINT literary_places_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.manga_access ADD CONSTRAINT manga_access_manga_id_fkey FOREIGN KEY (manga_id) REFERENCES public.mangas(id) ON DELETE CASCADE;
ALTER TABLE public.manga_favorites ADD CONSTRAINT manga_favorites_manga_id_fkey FOREIGN KEY (manga_id) REFERENCES public.mangas(id) ON DELETE CASCADE;
ALTER TABLE public.marketplace_delivery_codes ADD CONSTRAINT marketplace_delivery_codes_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.marketplace_delivery_codes ADD CONSTRAINT marketplace_delivery_codes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.marketplace_orders(id) ON DELETE CASCADE;
ALTER TABLE public.marketplace_delivery_codes ADD CONSTRAINT marketplace_delivery_codes_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.marketplace_order_items(id) ON DELETE CASCADE;
ALTER TABLE public.marketplace_delivery_codes ADD CONSTRAINT marketplace_delivery_codes_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.marketplace_delivery_codes ADD CONSTRAINT marketplace_delivery_codes_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketplace_listings ADD CONSTRAINT marketplace_listings_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.library_folders(id) ON DELETE SET NULL;
ALTER TABLE public.marketplace_listings ADD CONSTRAINT marketplace_listings_manga_id_fkey FOREIGN KEY (manga_id) REFERENCES public.mangas(id) ON DELETE SET NULL;
ALTER TABLE public.marketplace_listings ADD CONSTRAINT marketplace_listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.marketplace_order_items ADD CONSTRAINT marketplace_order_items_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.marketplace_listings(id) ON DELETE SET NULL;
ALTER TABLE public.marketplace_order_items ADD CONSTRAINT marketplace_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.marketplace_orders(id) ON DELETE CASCADE;
ALTER TABLE public.marketplace_orders ADD CONSTRAINT marketplace_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.marketplace_orders ADD CONSTRAINT marketplace_orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.marketplace_sellers ADD CONSTRAINT marketplace_sellers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.marketplace_wishlist ADD CONSTRAINT marketplace_wishlist_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.marketplace_listings(id) ON DELETE CASCADE;
ALTER TABLE public.marketplace_wishlist ADD CONSTRAINT marketplace_wishlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.page_bookmarks ADD CONSTRAINT page_bookmarks_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.bookmark_collections(id) ON DELETE CASCADE;
ALTER TABLE public.page_bookmarks ADD CONSTRAINT page_bookmarks_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(id) ON DELETE CASCADE;
ALTER TABLE public.pages ADD CONSTRAINT pages_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(id) ON DELETE CASCADE;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_manga_id_fkey FOREIGN KEY (manga_id) REFERENCES public.mangas(id) ON DELETE CASCADE;
ALTER TABLE public.reading_progress ADD CONSTRAINT reading_progress_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(id) ON DELETE CASCADE;
ALTER TABLE public.reading_time_daily ADD CONSTRAINT reading_time_daily_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_manga_id_fkey FOREIGN KEY (manga_id) REFERENCES public.mangas(id) ON DELETE CASCADE;
ALTER TABLE public.volumes ADD CONSTRAINT volumes_manga_id_fkey FOREIGN KEY (manga_id) REFERENCES public.mangas(id) ON DELETE CASCADE;
ALTER TABLE public.bookmark_collections ADD CONSTRAINT bookmark_collections_user_id_account_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD CONSTRAINT comments_user_id_account_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.content_removals ADD CONSTRAINT content_removals_removed_by_account_fkey FOREIGN KEY (removed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.library_folders ADD CONSTRAINT library_folders_creator_id_account_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.library_folders ADD CONSTRAINT library_folders_owner_id_account_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.library_items ADD CONSTRAINT library_items_owner_id_account_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.library_share_codes ADD CONSTRAINT library_share_codes_creator_id_account_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.library_share_codes ADD CONSTRAINT library_share_codes_used_by_account_fkey FOREIGN KEY (used_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.manga_access ADD CONSTRAINT manga_access_granted_by_account_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.manga_access ADD CONSTRAINT manga_access_user_id_account_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.manga_favorites ADD CONSTRAINT manga_favorites_user_id_account_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.mangas ADD CONSTRAINT mangas_creator_id_account_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.page_bookmarks ADD CONSTRAINT page_bookmarks_user_id_account_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profile_contacts ADD CONSTRAINT profile_contacts_user_id_account_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_user_id_account_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.reading_progress ADD CONSTRAINT reading_progress_user_id_account_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.reading_time_daily ADD CONSTRAINT reading_time_daily_user_id_account_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_account_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_account_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.system_access_daily ADD CONSTRAINT system_access_daily_user_id_account_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.system_access_state ADD CONSTRAINT system_access_state_user_id_account_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_account_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_auth_user_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_theme_check CHECK (theme IN ('light','vanilla','latte','cappuccino','mocha','coffee','dark','midnight'));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_manga_display_style_check CHECK (manga_display_style IN ('grid','book','showcase','realistic'));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_hq_display_style_check CHECK (hq_display_style IN ('grid','book','showcase','realistic'));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_gibi_display_style_check CHECK (gibi_display_style IN ('grid','book','showcase','realistic'));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_book_display_style_check CHECK (book_display_style IN ('grid','book','showcase','realistic'));
ALTER TABLE public.volumes ADD CONSTRAINT volumes_number_nonnegative CHECK (number >= 0);
ALTER TABLE public.pages ADD CONSTRAINT pages_index_nonnegative CHECK (page_index >= 0);
ALTER TABLE public.mangas ADD CONSTRAINT mangas_price_nonnegative CHECK (price_cents >= 0);
ALTER TABLE public.marketplace_listings ADD CONSTRAINT listings_positive_price CHECK (price_cents > 0);
ALTER TABLE public.marketplace_orders ADD CONSTRAINT orders_positive_total CHECK (total_cents > 0);
ALTER TABLE public.purchases ADD CONSTRAINT purchases_amount_nonnegative CHECK (amount_cents >= 0);
ALTER TABLE public.profile_contacts ADD CONSTRAINT profile_contacts_phone_check CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$');
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pair_unique UNIQUE(user_id, role);
ALTER TABLE public.mangas ADD CONSTRAINT mangas_slug_unique UNIQUE(slug);
ALTER TABLE public.mangas ADD CONSTRAINT mangas_invite_unique UNIQUE(invite_token);
ALTER TABLE public.volumes ADD CONSTRAINT volumes_manga_number_unique UNIQUE(manga_id, number);
ALTER TABLE public.pages ADD CONSTRAINT pages_volume_index_unique UNIQUE(volume_id, page_index);
ALTER TABLE public.friendships ADD CONSTRAINT friendships_unique_pair UNIQUE (requester_id, addressee_id);
ALTER TABLE public.friendships ADD CONSTRAINT friendships_not_self CHECK (requester_id <> addressee_id);
ALTER TABLE public.manga_access ADD CONSTRAINT manga_access_user_work_unique UNIQUE (user_id, manga_id);
ALTER TABLE public.library_items ADD CONSTRAINT library_items_owner_manga_unique UNIQUE (owner_id, manga_id);
ALTER TABLE public.reading_progress ADD CONSTRAINT reading_progress_unique UNIQUE (user_id, volume_id);
ALTER TABLE public.reading_time_daily ADD CONSTRAINT reading_time_daily_unique UNIQUE (user_id, volume_id, reading_date);
ALTER TABLE public.literary_place_confirmations ADD CONSTRAINT place_confirmations_unique UNIQUE (place_id, user_id);
ALTER TABLE public.literary_place_reviews ADD CONSTRAINT place_reviews_unique UNIQUE (place_id, user_id);
ALTER TABLE public.page_bookmarks ADD CONSTRAINT page_bookmarks_unique UNIQUE (user_id, collection_id, volume_id, page_index);
ALTER TABLE public.marketplace_delivery_codes ADD CONSTRAINT delivery_item_unique UNIQUE (order_item_id);
CREATE UNIQUE INDEX profiles_user_code_unique_ci ON public.profiles (lower(user_code)) WHERE user_code IS NOT NULL;
CREATE INDEX idx_mangas_catalog ON public.mangas(visibility,distribution_channel,created_at DESC);
CREATE INDEX idx_mangas_creator ON public.mangas(creator_id,created_at DESC);
CREATE INDEX idx_volumes_manga ON public.volumes(manga_id,number);
CREATE INDEX idx_pages_volume ON public.pages(volume_id,page_index);
CREATE INDEX idx_marketplace_listings_public ON public.marketplace_listings(active,created_at DESC);
CREATE INDEX idx_orders_buyer ON public.marketplace_orders(buyer_id,created_at DESC);
CREATE INDEX idx_orders_seller ON public.marketplace_orders(seller_id,created_at DESC);
CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX idx_messages_participants ON public.direct_messages(sender_id,receiver_id,created_at DESC);
CREATE INDEX idx_messages_receiver ON public.direct_messages(receiver_id,read_at);
CREATE INDEX idx_reading_progress_user ON public.reading_progress(user_id,updated_at DESC);
CREATE INDEX idx_library_items_folder ON public.library_items(folder_id,position);
CREATE INDEX idx_literary_places_geo ON public.literary_places(latitude,longitude);

-- 03 / TABELAS ADICIONAIS USADAS EM CÓDIGO MAS AUSENTES NA TIPAGEM GERADA
CREATE TABLE IF NOT EXISTS public.demo_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  tutorial_enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.demo_dashboard (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_key text NOT NULL, metric_label text NOT NULL,
  metric_value numeric NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id,metric_key)
);
CREATE TABLE IF NOT EXISTS public.demo_dashboard_access (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_number integer NOT NULL CHECK(month_number BETWEEN 1 AND 12),
  unique_visitors integer NOT NULL DEFAULT 0,
  visits integer NOT NULL DEFAULT 0,
  page_views integer NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id,month_number)
);
CREATE TABLE IF NOT EXISTS public.demo_dashboard_countries (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code text NOT NULL, country_name text NOT NULL,
  visits integer NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id,country_code)
);
CREATE TABLE IF NOT EXISTS public.demo_dashboard_revenue (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_key text NOT NULL, source_label text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id,source_key)
);
CREATE TABLE IF NOT EXISTS public.marketplace_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
 seller_id uuid NOT NULL REFERENCES public.profiles(id),
 reporter_id uuid NOT NULL REFERENCES public.profiles(id),
 reason text NOT NULL, details text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'open', resolution_note text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.marketplace_refund_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.marketplace_orders(id),
 buyer_id uuid NOT NULL REFERENCES public.profiles(id),
 seller_id uuid NOT NULL REFERENCES public.profiles(id),
 reason text NOT NULL, details text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'open', resolution_note text,
 requested_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,buyer_id)
);
CREATE TABLE IF NOT EXISTS public.support_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 name text NOT NULL, email text NOT NULL, topic text NOT NULL,
 subject text NOT NULL, message text NOT NULL,
 status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

-- 04 / FUNÇÕES DE IDENTIDADE, PRIVILÉGIO E ACESSO
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id AND r.role = _role);
$$;
CREATE OR REPLACE FUNCTION public.is_creator(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id
   AND r.role IN ('creator','editora','admin'));
$$;
CREATE OR REPLACE FUNCTION public.has_purchased(_user_id uuid,_manga_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.purchases p
   WHERE p.user_id = _user_id AND p.manga_id = _manga_id AND p.status = 'completed');
$$;
CREATE OR REPLACE FUNCTION public.can_access_manga(_user_id uuid,_manga_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 -- Consultas de acesso devem examinar apenas o próprio usuário autenticado.
 SELECT (_user_id IS NULL OR _user_id=auth.uid()) AND EXISTS (
  SELECT 1 FROM public.mangas m WHERE m.id = _manga_id
   AND (
     (m.visibility = 'public' AND m.distribution_channel = 'catalog' AND m.price_cents=0)
     OR (_user_id IS NOT NULL AND (
         m.creator_id = _user_id OR public.has_role(_user_id, 'admin'::public.app_role)
         OR EXISTS (SELECT 1 FROM public.manga_access ma WHERE ma.user_id=_user_id AND ma.manga_id=m.id)
         OR public.has_purchased(_user_id,m.id)
     ))
   )
 );
$$;
CREATE OR REPLACE FUNCTION public.can_manage_publication(_manga_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.mangas m WHERE m.id=_manga_id
   AND (m.creator_id=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))
 );
$$;
CREATE OR REPLACE FUNCTION public.can_manage_publication_volume(_volume_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.volumes v WHERE v.id=_volume_id
   AND public.can_manage_publication(v.manga_id));
$$;
CREATE OR REPLACE FUNCTION public.can_marketplace_chat(_user_id uuid,_other_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT _user_id IS NOT NULL AND _other_id IS NOT NULL AND _user_id<>_other_id
  AND (EXISTS (SELECT 1 FROM public.friendships f WHERE f.status='accepted'
      AND ((f.requester_id=_user_id AND f.addressee_id=_other_id)
        OR (f.requester_id=_other_id AND f.addressee_id=_user_id)))
  OR EXISTS (SELECT 1 FROM public.marketplace_orders o WHERE
    (o.buyer_id=_user_id AND o.seller_id=_other_id)
    OR (o.buyer_id=_other_id AND o.seller_id=_user_id)));
$$;
CREATE OR REPLACE FUNCTION public.is_free_sample_path(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.pages p
 JOIN public.volumes v ON v.id=p.volume_id
 JOIN public.mangas m ON m.id=v.manga_id
 WHERE p.storage_path=_path AND p.page_index=9 AND v.published
 AND m.visibility='public' AND m.distribution_channel IN ('catalog','marketplace'));
$$;
CREATE OR REPLACE FUNCTION public.can_read_page_path(_path text,_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.is_free_sample_path(_path)
  OR EXISTS (SELECT 1 FROM public.pages p JOIN public.volumes v ON v.id=p.volume_id
    WHERE p.storage_path=_path AND public.can_access_manga(_user_id,v.manga_id))
  OR EXISTS (SELECT 1 FROM public.volumes v WHERE v.source_path=_path
    AND public.can_access_manga(_user_id,v.manga_id));
$$;
CREATE OR REPLACE FUNCTION public.can_manage_publication_object(_bucket_id text,_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a text:=split_part(coalesce(_name,''),'/',1);
        b text:=split_part(coalesce(_name,''),'/',2);
        manga uuid; volume uuid;
BEGIN
 IF auth.uid() IS NULL OR _bucket_id NOT IN ('manga-covers','manga-pages','volume-sources')
 OR a !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 OR b='' THEN RETURN false; END IF;
 IF _bucket_id='manga-covers' AND a=auth.uid()::text THEN RETURN true; END IF;
 manga:=a::uuid;
 IF NOT public.can_manage_publication(manga) THEN RETURN false; END IF;
 IF _bucket_id='manga-covers' THEN RETURN true; END IF;
 IF b !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 OR split_part(_name,'/',3)='' THEN RETURN false; END IF;
 volume:=b::uuid;
 RETURN EXISTS(SELECT 1 FROM public.volumes v WHERE v.id=volume AND v.manga_id=manga);
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.profiles(id, display_name)
 VALUES(NEW.id, coalesce(nullif(btrim(NEW.raw_user_meta_data->>'display_name'),''),
   nullif(split_part(NEW.email,'@',1),''),'Leitor')) ON CONFLICT (id) DO NOTHING;
 INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'user'::public.app_role)
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
ALTER TABLE public.profiles ALTER COLUMN user_code SET DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
INSERT INTO public.profiles(id,display_name)
 SELECT id, coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),
 nullif(split_part(email,'@',1),''),'Leitor') FROM auth.users
 ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles(user_id,role)
 SELECT id,'user'::public.app_role FROM auth.users ON CONFLICT DO NOTHING;
-- Perfis pré-existentes recebem código de descoberta também.
UPDATE public.profiles SET user_code=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))
 WHERE user_code IS NULL;
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['bookmark_collections','content_removals','friendships','literary_place_reviews',
 'literary_places','manga_access','marketplace_listings','marketplace_orders','marketplace_sellers',
 'profile_contacts','profiles','reading_progress','reading_time_daily','site_settings',
 'subscriptions','marketplace_reports','marketplace_refund_requests','support_requests'] LOOP
 EXECUTE format('CREATE TRIGGER trg_update_timestamp BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_timestamp()',t);
 END LOOP;
END $$;

-- 05 / VIEWS PÚBLICAS: expõem apenas colunas expressamente listadas
CREATE VIEW public.marketplace_catalog WITH (security_barrier=true) AS
 SELECT l.id,l.seller_id,p.display_name AS seller_name,p.avatar_url AS seller_avatar_url,
 l.target_type,l.title,l.author,l.category,l.work_type,l.cover_url,l.price_cents,
 l.currency,l.created_at,l.manga_ids,s.sandbox_charges_enabled,s.live_charges_enabled
 FROM public.marketplace_listings l
 JOIN public.profiles p ON p.id=l.seller_id
 LEFT JOIN public.marketplace_sellers s ON s.user_id=l.seller_id
 WHERE l.active=true;
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
 FROM public.profiles p JOIN public.marketplace_sellers s ON s.user_id=p.id;

-- 06 / RLS: sem política = sem acesso cliente. Nenhum cliente grava pagamentos.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY[
  'bookmark_collections', 'comments', 'content_removals', 'demo_accounts', 'demo_dashboard',
  'demo_dashboard_access', 'demo_dashboard_countries', 'demo_dashboard_revenue', 'direct_messages', 'friend_share_codes',
  'friendships', 'library_folders', 'library_items', 'library_share_codes', 'literary_place_confirmations',
  'literary_place_reviews', 'literary_places', 'manga_access', 'manga_favorites', 'mangas',
  'marketplace_delivery_codes', 'marketplace_listings', 'marketplace_order_items', 'marketplace_orders', 'marketplace_refund_requests',
  'marketplace_reports', 'marketplace_sellers', 'marketplace_wishlist', 'page_bookmarks', 'pages',
  'profile_contacts', 'profiles', 'purchases', 'reading_progress', 'reading_time_daily',
  'reviews', 'site_settings', 'subscriptions', 'support_requests', 'system_access_daily',
  'system_access_state', 'user_roles', 'volumes'
 ] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
       EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
GRANT SELECT ON public.marketplace_catalog,public.marketplace_seller_stats TO anon,authenticated;
GRANT SELECT ON public.mangas,public.volumes,public.pages,public.literary_places,
 public.literary_place_reviews,public.literary_place_confirmations,public.reviews,
 public.marketplace_listings,public.marketplace_sellers,public.site_settings TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.profiles,public.profile_contacts,
 public.bookmark_collections,public.page_bookmarks,public.reading_progress,public.reading_time_daily,
 public.manga_favorites,public.marketplace_wishlist,public.library_folders,
 public.library_items,public.friendships,public.direct_messages,
 public.comments,public.reviews,public.literary_places,public.literary_place_reviews,
 public.literary_place_confirmations TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.mangas,public.volumes,public.pages,
 public.marketplace_listings,public.marketplace_sellers TO authenticated;
GRANT SELECT ON public.user_roles,public.manga_access,public.purchases,public.subscriptions,
 public.marketplace_orders,public.marketplace_order_items,public.marketplace_delivery_codes,
 public.friend_share_codes,public.library_share_codes,public.content_removals,
 public.marketplace_reports,public.marketplace_refund_requests,public.support_requests,
 public.demo_accounts,public.demo_dashboard,public.demo_dashboard_access,
 public.demo_dashboard_countries,public.demo_dashboard_revenue,
 public.system_access_daily,public.system_access_state TO authenticated;
GRANT INSERT,UPDATE ON public.site_settings TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.demo_accounts,public.demo_dashboard,public.demo_dashboard_access,
 public.demo_dashboard_countries,public.demo_dashboard_revenue TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;
-- Supabase service_role tem BYPASSRLS; nunca disponibilizar chave service_role no browser.

-- A política de perfil não é pública: busca de amigos via RPC segura.
CREATE POLICY profiles_self_select ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
CREATE POLICY profiles_admin_select ON public.profiles FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY profiles_self_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK(id=auth.uid());
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE POLICY profile_contacts_self_select ON public.profile_contacts FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY profile_contacts_self_insert ON public.profile_contacts FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY profile_contacts_self_update ON public.profile_contacts FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY profile_contacts_self_delete ON public.profile_contacts FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE POLICY user_roles_self_select ON public.user_roles FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY user_roles_admin_select ON public.user_roles FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY mangas_public_select ON public.mangas FOR SELECT TO anon,authenticated
 USING(visibility='public' AND distribution_channel='catalog'
 OR EXISTS(SELECT 1 FROM public.marketplace_listings l WHERE l.active AND id=ANY(l.manga_ids)));
CREATE POLICY mangas_owner_select ON public.mangas FOR SELECT TO authenticated
 USING(creator_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR public.can_access_manga(auth.uid(),id));
CREATE POLICY mangas_owner_insert ON public.mangas FOR INSERT TO authenticated
 WITH CHECK(creator_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY mangas_owner_update ON public.mangas FOR UPDATE TO authenticated
 USING(creator_id=auth.uid() OR public.has_role(auth.uid(),'admin'))
 WITH CHECK(creator_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY mangas_owner_delete ON public.mangas FOR DELETE TO authenticated
 USING(creator_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY volumes_public_select ON public.volumes FOR SELECT TO anon,authenticated
 USING(published AND EXISTS(SELECT 1 FROM public.mangas m WHERE m.id=manga_id
 AND m.visibility='public' AND m.distribution_channel='catalog' AND m.price_cents=0));
CREATE POLICY volumes_entitlement_select ON public.volumes FOR SELECT TO authenticated
 USING(public.can_access_manga(auth.uid(),manga_id) OR public.can_manage_publication(manga_id));
CREATE POLICY volumes_owner_insert ON public.volumes FOR INSERT TO authenticated WITH CHECK(public.can_manage_publication(manga_id));
CREATE POLICY volumes_owner_update ON public.volumes FOR UPDATE TO authenticated
 USING(public.can_manage_publication(manga_id)) WITH CHECK(public.can_manage_publication(manga_id));
CREATE POLICY volumes_owner_delete ON public.volumes FOR DELETE TO authenticated USING(public.can_manage_publication(manga_id));
CREATE POLICY pages_free_select ON public.pages FOR SELECT TO anon,authenticated
 USING(EXISTS(SELECT 1 FROM public.volumes v WHERE v.id=volume_id AND v.published
 AND public.can_access_manga(NULL,v.manga_id)));
CREATE POLICY pages_entitlement_select ON public.pages FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.volumes v WHERE v.id=volume_id
 AND public.can_access_manga(auth.uid(),v.manga_id)));
CREATE POLICY pages_owner_insert ON public.pages FOR INSERT TO authenticated WITH CHECK(public.can_manage_publication_volume(volume_id));
CREATE POLICY pages_owner_update ON public.pages FOR UPDATE TO authenticated
 USING(public.can_manage_publication_volume(volume_id)) WITH CHECK(public.can_manage_publication_volume(volume_id));
CREATE POLICY pages_owner_delete ON public.pages FOR DELETE TO authenticated USING(public.can_manage_publication_volume(volume_id));
CREATE POLICY access_self ON public.manga_access FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY purchases_self ON public.purchases FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY subscriptions_self ON public.subscriptions FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY listings_public_read ON public.marketplace_listings FOR SELECT TO anon,authenticated USING(active);
CREATE POLICY listings_owner_read ON public.marketplace_listings FOR SELECT TO authenticated USING(seller_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY listings_owner_insert ON public.marketplace_listings FOR INSERT TO authenticated
 WITH CHECK(seller_id=auth.uid() AND NOT active AND price_cents>0);
CREATE POLICY listings_owner_update ON public.marketplace_listings FOR UPDATE TO authenticated
 USING(seller_id=auth.uid() OR public.has_role(auth.uid(),'admin'))
 WITH CHECK(seller_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY listings_owner_delete ON public.marketplace_listings FOR DELETE TO authenticated
 USING(seller_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY seller_public_read ON public.marketplace_sellers FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY seller_self_insert ON public.marketplace_sellers FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
-- Flag de Stripe somente por backend. UPDATE via RPC segura para store_bio (se implementada).
CREATE POLICY seller_admin_update ON public.marketplace_sellers FOR UPDATE TO authenticated
 USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE POLICY seller_admin_delete ON public.marketplace_sellers FOR DELETE TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY orders_participant_read ON public.marketplace_orders FOR SELECT TO authenticated
 USING(auth.uid() IN (buyer_id,seller_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY order_items_participant_read ON public.marketplace_order_items FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.marketplace_orders o WHERE o.id=order_id
 AND (auth.uid() IN(o.buyer_id,o.seller_id) OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY delivery_codes_participant_read ON public.marketplace_delivery_codes FOR SELECT TO authenticated
 USING(auth.uid() IN(buyer_id,seller_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY wishlist_self ON public.marketplace_wishlist FOR ALL TO authenticated
 USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY favorites_self ON public.manga_favorites FOR ALL TO authenticated
 USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY bookmark_collections_self ON public.bookmark_collections FOR ALL TO authenticated
 USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY page_bookmarks_self ON public.page_bookmarks FOR ALL TO authenticated
 USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY progress_self ON public.reading_progress FOR ALL TO authenticated
 USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY reading_daily_self ON public.reading_time_daily FOR ALL TO authenticated
 USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY folders_self ON public.library_folders FOR ALL TO authenticated
 USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE POLICY library_items_self_read ON public.library_items FOR SELECT TO authenticated USING(owner_id=auth.uid());
-- library_items escrita APENAS via RPC de pasta/resgate com verificação de direitos.
REVOKE INSERT,UPDATE,DELETE ON public.library_items FROM authenticated;
CREATE POLICY friendships_participant_read ON public.friendships FOR SELECT TO authenticated
 USING(auth.uid() IN(requester_id,addressee_id));
CREATE POLICY friendships_requester_insert ON public.friendships FOR INSERT TO authenticated
 WITH CHECK(requester_id=auth.uid() AND addressee_id<>auth.uid() AND status='pending');
CREATE POLICY friendships_participant_delete ON public.friendships FOR DELETE TO authenticated
 USING(auth.uid() IN(requester_id,addressee_id));
CREATE POLICY direct_messages_participants ON public.direct_messages FOR SELECT TO authenticated
 USING(auth.uid() IN(sender_id,receiver_id));
-- mensagens e respostas por RPC apenas, impedindo falsificação de remetente.
REVOKE INSERT,UPDATE,DELETE ON public.direct_messages FROM authenticated;
CREATE POLICY reviews_public_read ON public.reviews FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY reviews_own_insert ON public.reviews FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY reviews_own_update ON public.reviews FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY reviews_own_delete ON public.reviews FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE POLICY comments_own_read ON public.comments FOR SELECT TO authenticated USING(true);
CREATE POLICY comments_own_insert ON public.comments FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY comments_own_update ON public.comments FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY comments_own_delete ON public.comments FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE POLICY literary_places_public_read ON public.literary_places FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY literary_places_create ON public.literary_places FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid());
CREATE POLICY literary_places_edit ON public.literary_places FOR UPDATE TO authenticated
 USING(created_by=auth.uid() OR public.has_role(auth.uid(),'admin'))
 WITH CHECK(created_by=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY literary_places_delete ON public.literary_places FOR DELETE TO authenticated
 USING(created_by=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY literary_reviews_public ON public.literary_place_reviews FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY literary_reviews_owner_insert ON public.literary_place_reviews FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY literary_reviews_owner_update ON public.literary_place_reviews FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY literary_reviews_owner_delete ON public.literary_place_reviews FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE POLICY literary_confirmations_public ON public.literary_place_confirmations FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY literary_confirmations_self_insert ON public.literary_place_confirmations FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY literary_confirmations_self_delete ON public.literary_place_confirmations FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE POLICY site_settings_public ON public.site_settings FOR SELECT TO anon,authenticated
 USING(key='donations' OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY site_settings_admin_insert ON public.site_settings FOR INSERT TO authenticated WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE POLICY site_settings_admin_update ON public.site_settings FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE POLICY demo_accounts_self_read ON public.demo_accounts FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY demo_accounts_admin_manage ON public.demo_accounts FOR ALL TO authenticated
 USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['demo_dashboard','demo_dashboard_access','demo_dashboard_countries','demo_dashboard_revenue'] LOOP
 EXECUTE format('CREATE POLICY demo_self_read ON public.%I FOR SELECT TO authenticated USING(user_id=auth.uid())',t);
 EXECUTE format('CREATE POLICY demo_admin_manage ON public.%I FOR ALL TO authenticated USING(public.has_role(auth.uid(),''admin'')) WITH CHECK(public.has_role(auth.uid(),''admin''))',t);
 END LOOP;
END $$;
CREATE POLICY reports_admin_select ON public.marketplace_reports FOR SELECT TO authenticated
 USING(reporter_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY refund_requests_participant ON public.marketplace_refund_requests FOR SELECT TO authenticated
 USING(auth.uid() IN(buyer_id,seller_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY support_requests_self ON public.support_requests FOR SELECT TO authenticated
 USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY content_removals_admin ON public.content_removals FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY daily_access_self ON public.system_access_daily FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY state_access_self ON public.system_access_state FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY friend_share_sender_read ON public.friend_share_codes FOR SELECT TO authenticated USING(auth.uid() IN(sender_id,recipient_id));
CREATE POLICY library_share_creator_read ON public.library_share_codes FOR SELECT TO authenticated USING(creator_id=auth.uid());

-- 07 / CAMPOS MAIS NOVOS REFERENCIADOS PELO CÓDIGO (NÃO ESTÃO EM types.ts)
ALTER TABLE public.marketplace_sellers ADD COLUMN store_bio text NOT NULL DEFAULT '',
 ADD COLUMN suspended_at timestamptz, ADD COLUMN suspension_reason text;
ALTER TABLE public.marketplace_listings ADD COLUMN moderation_status text NOT NULL DEFAULT 'active',
 ADD COLUMN moderation_note text;
-- Anúncios somente por RPC validada; dados Stripe não expostos no SELECT geral.
REVOKE INSERT,UPDATE,DELETE ON public.marketplace_listings FROM authenticated;
REVOKE SELECT ON public.marketplace_sellers FROM anon,authenticated;
GRANT SELECT (user_id,created_at,updated_at,featured,store_bio,
 suspended_at,suspension_reason,sandbox_charges_enabled,sandbox_payouts_enabled,
 sandbox_details_submitted,live_charges_enabled,live_payouts_enabled,live_details_submitted)
 ON public.marketplace_sellers TO anon,authenticated;

ALTER TABLE public.marketplace_orders ADD COLUMN fulfillment_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_reader_brightness_range CHECK(reader_brightness BETWEEN 0 AND 200);
ALTER TABLE public.reviews ADD CONSTRAINT review_rating_range CHECK(rating BETWEEN 1 AND 5);
ALTER TABLE public.literary_place_reviews ADD CONSTRAINT place_review_rating_range CHECK(rating BETWEEN 1 AND 5);
-- PostgREST exige coluna no banco antes de dar acesso à atualização por RPC.
CREATE OR REPLACE FUNCTION public.update_marketplace_seller_profile(_store_bio text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
 UPDATE public.marketplace_sellers SET store_bio=left(btrim(coalesce(_store_bio,'')),1500)
 WHERE user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Vendedor não cadastrado.'; END IF;
END $$;
-- Criação de seller não pode permitir que usuário ative flags Stripe pelo INSERT.
CREATE OR REPLACE FUNCTION public.protect_seller_billing_flags()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
   IF TG_OP='INSERT' THEN
    IF NEW.featured OR NEW.live_charges_enabled OR NEW.sandbox_charges_enabled
       OR NEW.live_payouts_enabled OR NEW.sandbox_payouts_enabled
       OR NEW.live_details_submitted OR NEW.sandbox_details_submitted
       OR NEW.stripe_live_account_id IS NOT NULL OR NEW.stripe_sandbox_account_id IS NOT NULL
    THEN RAISE EXCEPTION 'Dados de pagamentos controlados pelo servidor.'; END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_protect_seller_billing BEFORE INSERT ON public.marketplace_sellers
 FOR EACH ROW EXECUTE FUNCTION public.protect_seller_billing_flags();

-- Usuários precisam apenas descobrir nomes/códigos, nunca preferências privadas.
-- Busca restrita de leitores: não flexibilizar as políticas RLS de public.profiles.
-- Execute esta migração no projeto Supabase ligado ao Mangaka antes de testar os amigos.
-- Retorna exclusivamente os campos de perfil destinados a descoberta/contatos.

create or replace function public.search_readers(
  _query text,
  _max_results integer default 12
)
returns table(id uuid, display_name text, avatar_url text, user_code text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_query text := left(trim(regexp_replace(coalesce(_query, ''), '^\s*#\s*', '')), 64);
begin
  if v_user is null then
    raise exception 'É necessário entrar na conta para buscar leitores' using errcode = '42501';
  end if;

  if char_length(v_query) < 2 then
    return;
  end if;

  return query
    select p.id, p.display_name::text, p.avatar_url::text, p.user_code::text
      from public.profiles as p
     where p.id <> v_user
       and (
         position(lower(v_query) in lower(coalesce(p.display_name, ''))) > 0
         or (p.user_code is not null and lower(p.user_code) = lower(v_query))
       )
     order by
       case when lower(coalesce(p.user_code, '')) = lower(v_query) then 0
            when lower(coalesce(p.display_name, '')) = lower(v_query) then 1
            else 2 end,
       p.display_name, p.id
     limit greatest(1, least(coalesce(_max_results, 12), 12));
end;
$$;

revoke all on function public.search_readers(text, integer) from public, anon;
grant execute on function public.search_readers(text, integer) to authenticated;

-- Somente os perfis vinculados à conta podem ser usados em conversas/pedidos.
-- Não expõe configurações privadas de leitura, e-mail ou outros dados do usuário.
create or replace function public.get_reader_profiles(_ids uuid[])
returns table(id uuid, display_name text, avatar_url text, user_code text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'É necessário entrar na conta para consultar contatos' using errcode = '42501';
  end if;

  return query
    select p.id, p.display_name::text, p.avatar_url::text, p.user_code::text
      from public.profiles p
     where p.id = any(coalesce(_ids, array[]::uuid[]))
       and p.id <> v_user
       and (
         exists (
           select 1 from public.friendships f
            where f.status in ('pending', 'accepted')
              and ((f.requester_id = v_user and f.addressee_id = p.id)
                or (f.addressee_id = v_user and f.requester_id = p.id))
         )
         or exists (
           select 1 from public.marketplace_orders mo
            where (mo.buyer_id = v_user and mo.seller_id = p.id)
               or (mo.seller_id = v_user and mo.buyer_id = p.id)
         )
       )
     order by p.display_name
     limit 200;
end;
$$;

revoke all on function public.get_reader_profiles(uuid[]) from public, anon;
grant execute on function public.get_reader_profiles(uuid[]) to authenticated;

-- 08 / AMIZADES E MENSAGENS
CREATE OR REPLACE FUNCTION public.send_friend_request(_addressee_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); friend_id uuid;
BEGIN
 IF me IS NULL OR _addressee_id IS NULL OR me=_addressee_id THEN RAISE EXCEPTION 'Usuário inválido.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_addressee_id) THEN RAISE EXCEPTION 'Leitor não encontrado.'; END IF;
 SELECT id INTO friend_id FROM public.friendships
 WHERE (requester_id=me AND addressee_id=_addressee_id)
 OR (requester_id=_addressee_id AND addressee_id=me) LIMIT 1;
 IF friend_id IS NOT NULL THEN RETURN friend_id; END IF;
 INSERT INTO public.friendships(requester_id,addressee_id) VALUES(me,_addressee_id) RETURNING id INTO friend_id;
 RETURN friend_id;
END $$;
CREATE OR REPLACE FUNCTION public.respond_friend_request(_friendship_id uuid,_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
 UPDATE public.friendships SET status=CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END
 WHERE id=_friendship_id AND addressee_id=auth.uid() AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.send_direct_message(
 _receiver_id uuid, _body text DEFAULT '', _manga_id uuid DEFAULT NULL,
 _volume_id uuid DEFAULT NULL, _page_id uuid DEFAULT NULL,
 _share_type text DEFAULT NULL, _share_title text DEFAULT NULL,
 _share_path text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE new_id uuid;
BEGIN
 IF NOT public.can_marketplace_chat(auth.uid(),_receiver_id) THEN
 RAISE EXCEPTION 'Só é possível conversar com amigos ou participantes de pedidos.'; END IF;
 IF char_length(btrim(coalesce(_body,'')))=0 OR char_length(_body)>4000 THEN
 RAISE EXCEPTION 'Mensagem precisa ter entre 1 e 4000 caracteres.'; END IF;
 -- Anexos ou compartilhamentos só podem ser criados pela RPC de compartilhamento verificada.
 IF _manga_id IS NOT NULL OR _volume_id IS NOT NULL OR _page_id IS NOT NULL OR _share_type IS NOT NULL
 OR _share_path IS NOT NULL THEN RAISE EXCEPTION 'Use a função de compartilhamento para enviar arquivos.'; END IF;
 INSERT INTO public.direct_messages(sender_id,receiver_id,body) VALUES(auth.uid(),_receiver_id,_body)
 RETURNING id INTO new_id;
 RETURN new_id;
END $$;
CREATE OR REPLACE FUNCTION public.mark_direct_messages_read(_friend_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR _friend_id IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
 UPDATE public.direct_messages SET read_at=now()
 WHERE receiver_id=auth.uid() AND sender_id=_friend_id AND read_at IS NULL;
END $$;

-- 09 / PASTAS E ENTITLEMENTS: impedem compartilhar itens comprados.
CREATE OR REPLACE FUNCTION public.get_library_workspace()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN auth.uid() IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
 'folders',(SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.created_at),'[]'::jsonb)
            FROM public.library_folders f WHERE f.owner_id=auth.uid()),
 'items',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',li.id,'folder_id',li.folder_id,
          'manga',to_jsonb(m)) ORDER BY li.position),'[]'::jsonb)
          FROM public.library_items li JOIN public.mangas m ON m.id=li.manga_id
          WHERE li.owner_id=auth.uid()),
 'codes',(SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb)
          FROM public.library_share_codes c WHERE c.creator_id=auth.uid()
            AND c.expires_at>now())) END;
$$;
CREATE OR REPLACE FUNCTION public.save_library_folder(
 _name text,_manga_ids uuid[],_color text DEFAULT '#A58F79',_folder_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); folder uuid; works uuid[];
BEGIN
 IF me IS NULL OR char_length(btrim(coalesce(_name,''))) NOT BETWEEN 1 AND 100
 OR coalesce(cardinality(_manga_ids),0)>200 THEN RAISE EXCEPTION 'Pasta inválida.'; END IF;
 SELECT coalesce(array_agg(DISTINCT x),ARRAY[]::uuid[]) INTO works
 FROM unnest(coalesce(_manga_ids,ARRAY[]::uuid[])) x;
 IF EXISTS(SELECT 1 FROM unnest(works) x
 WHERE NOT public.can_access_manga(me,x)) THEN RAISE EXCEPTION 'Você não possui acesso a todos os itens.'; END IF;
 IF _folder_id IS NULL THEN
 INSERT INTO public.library_folders(name,color,owner_id,creator_id)
 VALUES(left(btrim(_name),100),left(coalesce(_color,'#A58F79'),32),me,me) RETURNING id INTO folder;
 ELSE
 UPDATE public.library_folders SET name=left(btrim(_name),100),color=left(coalesce(_color,'#A58F79'),32)
 WHERE id=_folder_id AND owner_id=me RETURNING id INTO folder;
 IF folder IS NULL THEN RAISE EXCEPTION 'Pasta não encontrada.'; END IF;
 END IF;
 -- Itens continuam pertencendo ao usuário; nunca concede direitos de leitura.
 UPDATE public.library_items SET folder_id=NULL WHERE folder_id=folder AND owner_id=me;
 INSERT INTO public.library_items(owner_id,manga_id,folder_id,position)
 SELECT me,x,folder,ord::integer FROM unnest(works) WITH ORDINALITY AS t(x,ord)
 ON CONFLICT(owner_id,manga_id) DO UPDATE SET folder_id=EXCLUDED.folder_id,position=EXCLUDED.position;
 RETURN folder;
END $$;
CREATE OR REPLACE FUNCTION public.redeem_library_share(
 _code text,_as_folder boolean,_folder_name text,_folder_color text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.library_share_codes%rowtype; me uuid:=auth.uid(); folder uuid; x uuid; counter integer:=0;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
 SELECT * INTO c FROM public.library_share_codes
 WHERE code=upper(btrim(_code)) FOR UPDATE;
 IF NOT FOUND OR c.expires_at<=now() OR c.used_at IS NOT NULL OR c.creator_id=me
 THEN RAISE EXCEPTION 'Código inexistente, expirado ou já utilizado.'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(c.manga_ids) id JOIN public.mangas m ON m.id=id
 WHERE m.creator_id IS DISTINCT FROM c.creator_id)
 OR EXISTS(SELECT 1 FROM unnest(c.manga_ids) id LEFT JOIN public.mangas m ON m.id=id WHERE m.id IS NULL)
 THEN RAISE EXCEPTION 'Origem de compartilhamento inválida.'; END IF;
 IF _as_folder THEN
 INSERT INTO public.library_folders(owner_id,creator_id,name,color)
 VALUES(me,c.creator_id,left(coalesce(nullif(btrim(_folder_name),''),c.folder_name),100),
 left(coalesce(_folder_color,'#A58F79'),32)) RETURNING id INTO folder;
 END IF;
 FOREACH x IN ARRAY c.manga_ids LOOP
  INSERT INTO public.manga_access(user_id,manga_id,granted_by,note)
  VALUES(me,x,c.creator_id,'library-share') ON CONFLICT (user_id,manga_id) DO NOTHING;
  INSERT INTO public.library_items(owner_id,manga_id,folder_id)
  VALUES(me,x,folder) ON CONFLICT(owner_id,manga_id) DO NOTHING;
  counter:=counter+1;
 END LOOP;
 UPDATE public.library_share_codes SET used_at=now(),used_by=me WHERE code=c.code;
 RETURN jsonb_build_object('files',counter,'folder_id',folder);
END $$;
-- Chamada abreviada preservada para clientes antigos.
CREATE OR REPLACE FUNCTION public.redeem_library_share(_code text,_as_folder boolean)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT public.redeem_library_share(_code,_as_folder,NULL,'#A58F79');
$$;

-- 10 / PAGAMENTOS: transações server-only. Validar webhook no servidor (código do ZIP).
CREATE OR REPLACE FUNCTION public.fulfill_marketplace_order(_order_id uuid,_stripe_session_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ord public.marketplace_orders%rowtype; it record; n integer:=0;
BEGIN
 -- Somente SERVICE ROLE deve possuir EXECUTE. Authenticated é revogado abaixo.
 SELECT * INTO ord FROM public.marketplace_orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
 IF nullif(btrim(coalesce(_stripe_session_id,'')),'') IS NULL
 OR ord.checkout_session_id IS DISTINCT FROM _stripe_session_id THEN
 RAISE EXCEPTION 'Sessão Stripe não confere com o pedido.';
 END IF;
 IF ord.status='paid' THEN RETURN jsonb_build_object('order_id',ord.id,'codes',0,'already_paid',true); END IF;
 IF ord.status NOT IN('pending','awaiting_payment') THEN RAISE EXCEPTION 'Pedido não está pendente.'; END IF;
 UPDATE public.marketplace_orders SET status='paid',paid_at=now(),fulfillment_status='delivered'
 WHERE id=ord.id;
 FOR it IN SELECT * FROM public.marketplace_order_items WHERE order_id=ord.id LOOP
  IF EXISTS(SELECT 1 FROM unnest(it.manga_ids) w
    LEFT JOIN public.mangas m ON m.id=w WHERE m.id IS NULL OR m.creator_id IS DISTINCT FROM ord.seller_id)
  THEN RAISE EXCEPTION 'Item de pedido inconsistente.'; END IF;
  INSERT INTO public.marketplace_delivery_codes(
   buyer_id,code,manga_ids,order_id,order_item_id,seller_id,target_type,title,folder_color)
  VALUES (ord.buyer_id,upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
   it.manga_ids,ord.id,it.id,ord.seller_id,it.target_type,it.title,it.folder_color)
  ON CONFLICT(order_item_id) DO NOTHING;
  n:=n+1;
 END LOOP;
 RETURN jsonb_build_object('order_id',ord.id,'codes',n,'status','paid');
END $$;
REVOKE ALL ON FUNCTION public.fulfill_marketplace_order(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_marketplace_order(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_marketplace_code(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.marketplace_delivery_codes%rowtype; ord public.marketplace_orders%rowtype;
 x uuid; imported integer:=0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
 SELECT * INTO c FROM public.marketplace_delivery_codes WHERE code=upper(btrim(_code)) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Código não encontrado.'; END IF;
 SELECT * INTO ord FROM public.marketplace_orders WHERE id=c.order_id;
 IF ord.status<>'paid' OR ord.buyer_id<>auth.uid() OR c.buyer_id<>auth.uid() THEN
 RAISE EXCEPTION 'Pagamento não confirmado ou código não pertence à sua conta.'; END IF;
 IF c.used_at IS NOT NULL THEN RETURN jsonb_build_object('files',0,'already_redeemed',true); END IF;
 IF EXISTS(SELECT 1 FROM unnest(c.manga_ids) w LEFT JOIN public.mangas m ON m.id=w
  WHERE m.id IS NULL OR m.creator_id IS DISTINCT FROM ord.seller_id) THEN
 RAISE EXCEPTION 'Integridade da entrega comprometida.'; END IF;
 FOREACH x IN ARRAY c.manga_ids LOOP
  INSERT INTO public.manga_access(user_id,manga_id,granted_by,note)
   VALUES(auth.uid(),x,ord.seller_id,'marketplace-order:'||ord.id::text)
   ON CONFLICT(user_id,manga_id) DO NOTHING;
  INSERT INTO public.library_items(owner_id,manga_id) VALUES(auth.uid(),x)
   ON CONFLICT(owner_id,manga_id) DO NOTHING;
  imported:=imported+1;
 END LOOP;
 UPDATE public.marketplace_delivery_codes SET used_at=now(),used_by=auth.uid() WHERE code=c.code;
 RETURN jsonb_build_object('files',imported,'code',c.code);
END $$;
CREATE OR REPLACE FUNCTION public.redeem_marketplace_order(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ord public.marketplace_orders%rowtype; c record; code_count integer:=0; file_count integer:=0; result jsonb;
BEGIN
 SELECT * INTO ord FROM public.marketplace_orders WHERE id=_order_id;
 IF NOT FOUND OR ord.buyer_id IS DISTINCT FROM auth.uid() OR ord.status<>'paid' THEN
 RAISE EXCEPTION 'Pedido não pago ou não pertence à sua conta.'; END IF;
 FOR c IN SELECT code FROM public.marketplace_delivery_codes
 WHERE order_id=_order_id AND buyer_id=auth.uid() AND used_at IS NULL
 LOOP
   result:=public.redeem_marketplace_code(c.code);
   code_count:=code_count+1;
   file_count:=file_count+coalesce((result->>'files')::integer,0);
 END LOOP;
 RETURN jsonb_build_object('codes',code_count,'files',file_count);
END $$;
CREATE OR REPLACE FUNCTION public.get_marketplace_order_details(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.marketplace_orders%rowtype;
BEGIN
 SELECT * INTO o FROM public.marketplace_orders WHERE id=_order_id;
 IF NOT FOUND OR (auth.uid() NOT IN(o.buyer_id,o.seller_id)
 AND NOT public.has_role(auth.uid(),'admin'::public.app_role)) THEN
 RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
 RETURN jsonb_build_object('id',o.id,'buyer_id',o.buyer_id,'seller_id',o.seller_id,
 'status',o.status,'total_cents',o.total_cents,'currency',o.currency,
 'checkout_url',o.checkout_url,'paid_at',o.paid_at,'stripe_environment',o.stripe_environment,
 'items',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,
   'target_type',i.target_type,'price_cents',i.price_cents,'cover_url',i.cover_url,
   'work_type',i.work_type)),'[]'::jsonb) FROM public.marketplace_order_items i WHERE i.order_id=o.id),
 'codes',(SELECT coalesce(jsonb_agg(jsonb_build_object('code',c.code,'title',c.title,
    'target_type',c.target_type,'used_at',c.used_at)),'[]'::jsonb)
    FROM public.marketplace_delivery_codes c WHERE c.order_id=o.id AND
    (o.buyer_id=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))));
END $$;

-- RPC de criação usada pelo navegador; não dá baixa de pagamento.
CREATE OR REPLACE FUNCTION public.create_marketplace_order(_listing_ids uuid[],_environment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); seller uuid; total integer; quantity integer; order_id uuid;
BEGIN
 IF me IS NULL OR _environment NOT IN('sandbox','live') OR _listing_ids IS NULL
 OR cardinality(_listing_ids) NOT BETWEEN 1 AND 20 OR array_position(_listing_ids,NULL) IS NOT NULL
 OR (SELECT count(DISTINCT x) FROM unnest(_listing_ids) x)<>cardinality(_listing_ids)
 THEN RAISE EXCEPTION 'Pedido inválido.'; END IF;
 SELECT count(*),(array_agg(l.seller_id))[1],sum(l.price_cents)
 INTO quantity,seller,total FROM public.marketplace_listings l
 WHERE l.id=ANY(_listing_ids) AND l.active AND l.moderation_status='active';
 IF quantity<>cardinality(_listing_ids) OR seller IS NULL OR seller=me OR total<=0
 OR EXISTS(SELECT 1 FROM public.marketplace_listings l WHERE l.id=ANY(_listing_ids)
 AND (l.seller_id<>seller OR l.currency<>'BRL' OR cardinality(l.manga_ids)=0))
 THEN RAISE EXCEPTION 'Carrinho contém itens indisponíveis ou de vendedores diferentes.'; END IF;
 IF EXISTS(SELECT 1 FROM public.marketplace_listings l CROSS JOIN LATERAL unnest(l.manga_ids) w
 LEFT JOIN public.mangas m ON m.id=w WHERE l.id=ANY(_listing_ids)
 AND (m.id IS NULL OR m.creator_id IS DISTINCT FROM seller))
 THEN RAISE EXCEPTION 'Anúncio não pertence ao vendedor.'; END IF;
 IF EXISTS(SELECT 1 FROM public.marketplace_sellers s WHERE s.user_id=seller AND s.suspended_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Vendedor indisponível.'; END IF;
 IF NOT public.has_role(seller,'admin'::public.app_role) AND NOT EXISTS(
 SELECT 1 FROM public.marketplace_sellers s WHERE s.user_id=seller
 AND CASE WHEN _environment='live' THEN s.live_charges_enabled ELSE s.sandbox_charges_enabled END
 AND nullif(CASE WHEN _environment='live' THEN s.stripe_live_account_id ELSE s.stripe_sandbox_account_id END,'') IS NOT NULL)
 THEN RAISE EXCEPTION 'Vendedor ainda não recebe pagamentos neste ambiente.'; END IF;
 INSERT INTO public.marketplace_orders(buyer_id,seller_id,total_cents,currency,stripe_environment,stripe_account_id)
 SELECT me,seller,total,'BRL',_environment,
 CASE WHEN public.has_role(seller,'admin'::public.app_role) THEN NULL
 ELSE CASE WHEN _environment='live' THEN s.stripe_live_account_id ELSE s.stripe_sandbox_account_id END END
 FROM (SELECT 1) base LEFT JOIN public.marketplace_sellers s ON s.user_id=seller
 RETURNING id INTO order_id;
 INSERT INTO public.marketplace_order_items(order_id,listing_id,target_type,title,author,
 category,work_type,cover_url,folder_color,manga_ids,price_cents,currency)
 SELECT order_id,l.id,l.target_type,l.title,l.author,l.category,l.work_type,
 l.cover_url,l.folder_color,l.manga_ids,l.price_cents,l.currency
 FROM public.marketplace_listings l WHERE l.id=ANY(_listing_ids);
 INSERT INTO public.direct_messages(sender_id,receiver_id,body,message_kind,marketplace_order_id)
 VALUES(me,seller,'Pedido do marketplace: '||order_id::text,'marketplace_order',order_id);
 RETURN jsonb_build_object('order_id',order_id,'seller_id',seller,'total_cents',total);
END $$;

-- Código exato do projeto: RPCs server-only para pedido direto de catálogo e marketplace.

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



-- 11 / METRICAS, CONVITES, LISTAGENS E SUPORTE
CREATE OR REPLACE FUNCTION public.add_reading_time(p_seconds integer,p_volume_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR p_seconds NOT BETWEEN 1 AND 3600 OR NOT EXISTS (
 SELECT 1 FROM public.volumes v WHERE v.id=p_volume_id AND public.can_access_manga(auth.uid(),v.manga_id))
 THEN RAISE EXCEPTION 'Registro de leitura inválido.'; END IF;
 INSERT INTO public.reading_time_daily(user_id,volume_id,reading_date,seconds_read)
 VALUES(auth.uid(),p_volume_id,current_date,p_seconds)
 ON CONFLICT(user_id,volume_id,reading_date) DO UPDATE
 SET seconds_read=least(public.reading_time_daily.seconds_read+EXCLUDED.seconds_read,86400);
END $$;
CREATE OR REPLACE FUNCTION public.record_system_access()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE last_time timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RETURN; END IF;
 SELECT last_seen INTO last_time FROM public.system_access_state WHERE user_id=auth.uid() FOR UPDATE;
 IF last_time IS NULL OR last_time < now()-interval '30 minutes' THEN
  INSERT INTO public.system_access_daily(user_id,day,sessions)
  VALUES(auth.uid(),current_date,1)
  ON CONFLICT(user_id,day) DO UPDATE SET sessions=public.system_access_daily.sessions+1;
 END IF;
 INSERT INTO public.system_access_state(user_id,last_seen) VALUES(auth.uid(),now())
 ON CONFLICT(user_id) DO UPDATE SET last_seen=excluded.last_seen;
END $$;
CREATE OR REPLACE FUNCTION public.increment_manga_view(_manga_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.mangas SET view_count=view_count+1 WHERE id=_manga_id
 AND (visibility='public' OR creator_id=auth.uid());
END $$;
CREATE OR REPLACE FUNCTION public.redeem_manga_invite(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE work_id uuid; creator uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
 SELECT id,creator_id INTO work_id,creator FROM public.mangas
 WHERE invite_token=_token AND visibility='invite';
 IF work_id IS NULL OR creator IS NULL THEN RAISE EXCEPTION 'Convite inválido.'; END IF;
 INSERT INTO public.manga_access(user_id,manga_id,granted_by,note)
 VALUES(auth.uid(),work_id,creator,'invite') ON CONFLICT(user_id,manga_id) DO NOTHING;
 RETURN work_id;
END $$;
CREATE OR REPLACE FUNCTION public.get_similar_marketplace_listings(_manga_id uuid,_limit integer DEFAULT 20)
RETURNS TABLE(listing_id uuid,similarity_score integer,source_title text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT l.id,
  (CASE WHEN m.category=target.category THEN 40 ELSE 0 END
  + CASE WHEN m.work_type=target.work_type THEN 40 ELSE 0 END
  + CASE WHEN m.author=target.author THEN 20 ELSE 0 END)::integer AS similarity_score,
  m.title::text AS source_title
 FROM public.mangas target
 JOIN public.mangas m ON m.id<>target.id
 JOIN public.marketplace_listings l ON m.id=ANY(l.manga_ids)
 WHERE target.id=_manga_id AND l.active AND l.moderation_status='active'
 ORDER BY similarity_score DESC,l.created_at DESC
 LIMIT least(greatest(coalesce(_limit,20),1),100);
$$;
CREATE OR REPLACE FUNCTION public.upsert_marketplace_listing(_target_type text,_target_id uuid,_price_cents integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); work public.mangas%rowtype; fold public.library_folders%rowtype;
        v_ids uuid[]; v_listing uuid; v_title text; v_author text; v_cat text; v_kind text; v_cover text; v_color text;
BEGIN
 IF me IS NULL OR _price_cents NOT BETWEEN 100 AND 2147483647
 OR _target_type NOT IN('manga','folder') THEN RAISE EXCEPTION 'Anúncio inválido.'; END IF;
 IF EXISTS(SELECT 1 FROM public.marketplace_sellers s WHERE s.user_id=me AND s.suspended_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Vendedor suspenso.'; END IF;
 IF _target_type='manga' THEN
  SELECT * INTO work FROM public.mangas WHERE id=_target_id AND creator_id=me;
  IF NOT FOUND THEN RAISE EXCEPTION 'Você não é criador desta obra.'; END IF;
  v_ids:=ARRAY[work.id];v_title:=work.title;v_author:=work.author;v_cat:=work.category;
  v_kind:=work.work_type;v_cover:=work.cover_url;
 ELSE
  SELECT * INTO fold FROM public.library_folders WHERE id=_target_id AND owner_id=me AND creator_id=me;
  IF NOT FOUND THEN RAISE EXCEPTION 'Você não criou esta pasta.'; END IF;
  SELECT coalesce(array_agg(li.manga_id ORDER BY li.position),ARRAY[]::uuid[]) INTO v_ids
  FROM public.library_items li WHERE li.folder_id=fold.id AND li.owner_id=me;
  IF cardinality(v_ids)=0 OR EXISTS(SELECT 1 FROM unnest(v_ids) x LEFT JOIN public.mangas m ON m.id=x
     WHERE m.creator_id IS DISTINCT FROM me) THEN RAISE EXCEPTION 'Pasta vazia ou contém conteúdo de terceiros.'; END IF;
  v_title:=fold.name;v_author:='';v_cat:='Coleção';v_kind:='book';v_color:=fold.color;
 END IF;
 SELECT id INTO v_listing FROM public.marketplace_listings
 WHERE seller_id=me AND target_type=_target_type
 AND ((_target_type='manga' AND manga_id=_target_id) OR (_target_type='folder' AND folder_id=_target_id))
 LIMIT 1;
 IF v_listing IS NULL THEN
  INSERT INTO public.marketplace_listings(seller_id,target_type,manga_id,folder_id,
  manga_ids,title,author,category,work_type,cover_url,folder_color,price_cents,active)
  VALUES(me,_target_type,CASE WHEN _target_type='manga' THEN _target_id END,
  CASE WHEN _target_type='folder' THEN _target_id END,
  v_ids,v_title,v_author,v_cat,v_kind,v_cover,v_color,_price_cents,false) RETURNING id INTO v_listing;
 ELSE
  UPDATE public.marketplace_listings SET title=v_title,author=v_author,
   price_cents=_price_cents,manga_ids=v_ids,moderation_status='active',active=false
  WHERE id=v_listing;
 END IF;
 RETURN v_listing;
END $$;
CREATE OR REPLACE FUNCTION public.set_marketplace_listing_active(_listing_id uuid,_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
 UPDATE public.marketplace_listings l SET active=_active
 WHERE l.id=_listing_id AND l.seller_id=auth.uid()
 AND l.moderation_status='active'
 AND NOT EXISTS(SELECT 1 FROM public.marketplace_sellers s
 WHERE s.user_id=l.seller_id AND s.suspended_at IS NOT NULL);
 IF NOT FOUND THEN RAISE EXCEPTION 'Anúncio não encontrado ou bloqueado.'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.format_brl(_cents integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT 'R$ '||to_char(coalesce(_cents,0)::numeric/100,'FM999G999G999G990D00');
$$;
CREATE OR REPLACE FUNCTION public.create_support_request(
 _name text,_email text,_topic text,_subject text,_message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE request_id uuid;
BEGIN
 IF char_length(btrim(coalesce(_name,''))) NOT BETWEEN 2 AND 100
 OR char_length(btrim(coalesce(_email,''))) NOT BETWEEN 5 AND 254
 OR char_length(btrim(coalesce(_subject,''))) NOT BETWEEN 3 AND 180
 OR char_length(btrim(coalesce(_message,''))) NOT BETWEEN 10 AND 5000
 THEN RAISE EXCEPTION 'Preencha os campos de suporte corretamente.'; END IF;
 INSERT INTO public.support_requests(user_id,name,email,topic,subject,message)
 VALUES(auth.uid(),left(_name,100),left(_email,254),left(coalesce(_topic,'outros'),60),
 left(_subject,180),left(_message,5000)) RETURNING id INTO request_id;
 RETURN request_id;
END $$;
CREATE OR REPLACE FUNCTION public.report_marketplace_listing(
 _listing_id uuid,_reason text,_details text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid; new_id uuid;
BEGIN
 IF auth.uid() IS NULL OR char_length(btrim(coalesce(_reason,''))) NOT BETWEEN 2 AND 100
 THEN RAISE EXCEPTION 'Denúncia inválida.'; END IF;
 SELECT seller_id INTO owner_id FROM public.marketplace_listings WHERE id=_listing_id;
 IF owner_id IS NULL OR owner_id=auth.uid() THEN RAISE EXCEPTION 'Anúncio inválido.'; END IF;
 INSERT INTO public.marketplace_reports(listing_id,seller_id,reporter_id,reason,details)
 VALUES(_listing_id,owner_id,auth.uid(),left(_reason,100),left(coalesce(_details,''),3000))
 RETURNING id INTO new_id;
 RETURN new_id;
END $$;
CREATE OR REPLACE FUNCTION public.request_marketplace_refund(
 _order_id uuid,_reason text,_details text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ord public.marketplace_orders%rowtype; new_id uuid;
BEGIN
 SELECT * INTO ord FROM public.marketplace_orders WHERE id=_order_id AND buyer_id=auth.uid() AND status='paid';
 IF NOT FOUND OR char_length(btrim(coalesce(_reason,''))) NOT BETWEEN 3 AND 200
 THEN RAISE EXCEPTION 'Solicitação inválida: pedido deve estar pago.'; END IF;
 INSERT INTO public.marketplace_refund_requests(order_id,buyer_id,seller_id,reason,details)
 VALUES(ord.id,ord.buyer_id,ord.seller_id,left(_reason,200),left(coalesce(_details,''),3000))
 RETURNING id INTO new_id;
 RETURN new_id;
END $$;
CREATE OR REPLACE FUNCTION public.get_admin_dashboard(_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE period integer:=least(greatest(coalesce(_days,30),1),365);
BEGIN
 IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Acesso de administrador necessário.'; END IF;
 RETURN jsonb_build_object('users',jsonb_build_object(
 'total',(SELECT count(*) FROM public.profiles),
 'plus',(SELECT count(DISTINCT user_id) FROM public.subscriptions WHERE status IN('active','trialing') AND plan_code<>'free'),
 'free',(SELECT count(*) FROM public.profiles)-(SELECT count(DISTINCT user_id) FROM public.subscriptions WHERE status IN('active','trialing') AND plan_code<>'free')),
 'works',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (
    SELECT work_type AS type,count(*)::integer AS count FROM public.mangas GROUP BY work_type) x),
 'access',jsonb_build_object(
   'total',(SELECT coalesce(sum(sessions),0) FROM public.system_access_daily WHERE day>=current_date-period),
   'uniqueUsers',(SELECT count(DISTINCT user_id) FROM public.system_access_daily WHERE day>=current_date-period),
   'firstRecordedDay',(SELECT min(day) FROM public.system_access_daily),
   'days',(SELECT coalesce(jsonb_agg(x ORDER BY date),'[]'::jsonb)
     FROM (SELECT day AS date,sum(sessions)::integer AS sessions,count(DISTINCT user_id)::integer AS users
       FROM public.system_access_daily WHERE day>=current_date-period GROUP BY day) x)),
 'updatedAt',now());
END $$;

-- 12 / REGRAS DE MODERAÇÃO: análise não representa reembolso financeiro.
CREATE OR REPLACE FUNCTION public.admin_set_marketplace_seller_featured(_seller_id uuid,_featured boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 UPDATE public.marketplace_sellers SET featured=_featured WHERE user_id=_seller_id;
END $$;
CREATE OR REPLACE FUNCTION public.admin_set_marketplace_seller_suspension(
 _seller_id uuid,_suspended boolean,_reason text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 UPDATE public.marketplace_sellers SET suspended_at=CASE WHEN _suspended THEN now() ELSE NULL END,
 suspension_reason=CASE WHEN _suspended THEN left(coalesce(_reason,''),1000) ELSE NULL END
 WHERE user_id=_seller_id;
 IF _suspended THEN UPDATE public.marketplace_listings SET active=false WHERE seller_id=_seller_id; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.admin_set_marketplace_listing_status(
 _listing_id uuid,_status text,_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 IF _status NOT IN('active','under_review','removed') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
 UPDATE public.marketplace_listings SET moderation_status=_status,moderation_note=left(_note,3000),
 active=CASE WHEN _status='active' THEN active ELSE false END WHERE id=_listing_id;
END $$;
CREATE OR REPLACE FUNCTION public.admin_review_marketplace_report(_report_id uuid,_status text,_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 IF _status NOT IN('reviewing','resolved','dismissed') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
 UPDATE public.marketplace_reports SET status=_status,resolution_note=left(coalesce(_note,''),3000) WHERE id=_report_id;
END $$;
CREATE OR REPLACE FUNCTION public.admin_review_marketplace_refund(_request_id uuid,_status text,_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 IF _status NOT IN('under_review','approved','rejected') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
 UPDATE public.marketplace_refund_requests SET status=_status,resolution_note=left(coalesce(_note,''),3000)
 WHERE id=_request_id;
 -- NOTA: não altera status do pedido nem realiza reembolso na Stripe.
END $$;
CREATE OR REPLACE FUNCTION public.admin_review_support_request(_request_id uuid,_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
 IF _status NOT IN('open','reviewing','resolved','closed') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
 UPDATE public.support_requests SET status=_status WHERE id=_request_id;
END $$;

-- 13 / COMPARTILHAMENTO DO PROJETO: utiliza implementação original, com a
-- verificação de titularidade da pasta e dos livros embutida.
-- Compartilhamento seguro de biblioteca.
-- Regra: somente conteúdo criado pelo próprio usuário pode ser compartilhado.
-- Itens comprados, importados ou apenas adicionados à biblioteca não podem ser redistribuídos.

create or replace function public.generate_library_share(_folder_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_folder public.library_folders%rowtype;
  v_manga_ids uuid[];
  v_code text;
  v_expires_at timestamptz := now() + interval '12 hours';
begin
  if v_user is null then
    raise exception 'Entre na sua conta para compartilhar.' using errcode = '42501';
  end if;

  select * into v_folder
  from public.library_folders
  where id = _folder_id
    and owner_id = v_user
    and creator_id = v_user;

  if not found then
    raise exception 'Somente o criador da pasta pode compartilhá-la.' using errcode = '42501';
  end if;

  select coalesce(array_agg(li.manga_id order by li.position), array[]::uuid[])
    into v_manga_ids
  from public.library_items li
  where li.folder_id = _folder_id
    and li.owner_id = v_user;

  if exists (
    select 1
    from unnest(v_manga_ids) as x(manga_id)
    left join public.mangas m on m.id = x.manga_id
    where m.id is null or m.creator_id is distinct from v_user
  ) then
    raise exception 'Esta pasta contém item comprado ou importado. Somente criações próprias podem ser compartilhadas.'
      using errcode = '42501';
  end if;

  update public.library_share_codes
     set expires_at = now()
   where folder_id = _folder_id
     and creator_id = v_user
     and used_at is null
     and expires_at > now();

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.library_share_codes (
    code, creator_id, folder_id, folder_name, manga_ids, expires_at
  ) values (
    v_code, v_user, _folder_id, v_folder.name, v_manga_ids, v_expires_at
  );

  return jsonb_build_object(
    'code', v_code,
    'expires_at', v_expires_at,
    'folder_id', _folder_id
  );
end;
$$;

revoke all on function public.generate_library_share(uuid) from public, anon;
grant execute on function public.generate_library_share(uuid) to authenticated;


create or replace function public.share_code_with_friend(
  _receiver_id uuid,
  _share_type text,
  _title text,
  _path text default null,
  _folder_id uuid default null,
  _manga_id uuid default null,
  _volume_id uuid default null,
  _page_id uuid default null,
  _message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_manga_id uuid;
  v_manga_ids uuid[] := array[]::uuid[];
  v_folder public.library_folders%rowtype;
  v_folder_name text;
  v_folder_color text;
  v_code text;
  v_expires_at timestamptz := now() + interval '12 hours';
  v_message text := left(trim(coalesce(_message, '')), 1500);
begin
  if v_user is null then
    raise exception 'Entre na sua conta para compartilhar.' using errcode = '42501';
  end if;

  if _receiver_id is null or _receiver_id = v_user then
    raise exception 'Escolha outro usuário para compartilhar.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles p where p.id = _receiver_id) then
    raise exception 'Usuário não encontrado.' using errcode = '22023';
  end if;

  -- Compartilhamento direto é permitido apenas entre amizades aceitas.
  if not exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = v_user and f.addressee_id = _receiver_id)
        or
        (f.requester_id = _receiver_id and f.addressee_id = v_user)
      )
  ) then
    raise exception 'Adicione este usuário como amigo antes de compartilhar.' using errcode = '42501';
  end if;

  case _share_type
    when 'folder' then
      if _folder_id is null then
        raise exception 'Pasta inválida.' using errcode = '22023';
      end if;

      select * into v_folder
      from public.library_folders
      where id = _folder_id
        and owner_id = v_user
        and creator_id = v_user;

      if not found then
        raise exception 'Somente o criador da pasta pode compartilhá-la.' using errcode = '42501';
      end if;

      select coalesce(array_agg(li.manga_id order by li.position), array[]::uuid[])
        into v_manga_ids
      from public.library_items li
      where li.folder_id = _folder_id
        and li.owner_id = v_user;

      if exists (
        select 1
        from unnest(v_manga_ids) as x(manga_id)
        left join public.mangas m on m.id = x.manga_id
        where m.id is null or m.creator_id is distinct from v_user
      ) then
        raise exception 'Esta pasta contém item comprado ou importado. Somente criações próprias podem ser compartilhadas.'
          using errcode = '42501';
      end if;

      v_folder_name := v_folder.name;
      v_folder_color := v_folder.color;

    when 'manga' then
      if _manga_id is null then
        raise exception 'Obra inválida.' using errcode = '22023';
      end if;
      select m.id into v_manga_id
      from public.mangas m
      where m.id = _manga_id and m.creator_id = v_user;
      if not found then
        raise exception 'Itens comprados não podem ser compartilhados. Somente o criador da obra pode compartilhá-la.'
          using errcode = '42501';
      end if;
      v_manga_ids := array[v_manga_id];

    when 'volume' then
      if _volume_id is null then
        raise exception 'Volume inválido.' using errcode = '22023';
      end if;
      select m.id into v_manga_id
      from public.volumes v
      join public.mangas m on m.id = v.manga_id
      where v.id = _volume_id and m.creator_id = v_user;
      if not found then
        raise exception 'Itens comprados não podem ser compartilhados. Somente o criador da obra pode compartilhar este volume.'
          using errcode = '42501';
      end if;
      v_manga_ids := array[v_manga_id];

    when 'page' then
      if _page_id is null then
        raise exception 'Página inválida.' using errcode = '22023';
      end if;
      select m.id into v_manga_id
      from public.pages p
      join public.volumes v on v.id = p.volume_id
      join public.mangas m on m.id = v.manga_id
      where p.id = _page_id and m.creator_id = v_user;
      if not found then
        raise exception 'Itens comprados não podem ser compartilhados. Somente o criador da obra pode compartilhar esta página.'
          using errcode = '42501';
      end if;
      v_manga_ids := array[v_manga_id];

    else
      raise exception 'Tipo de compartilhamento inválido.' using errcode = '22023';
  end case;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.friend_share_codes (
    code,
    sender_id,
    recipient_id,
    share_type,
    title,
    share_path,
    folder_id,
    folder_name,
    folder_color,
    manga_id,
    manga_ids,
    volume_id,
    page_id,
    expires_at
  ) values (
    v_code,
    v_user,
    _receiver_id,
    _share_type,
    left(coalesce(_title, 'Compartilhamento'), 200),
    nullif(left(coalesce(_path, ''), 1000), ''),
    _folder_id,
    v_folder_name,
    v_folder_color,
    case when _share_type = 'manga' then v_manga_id else _manga_id end,
    v_manga_ids,
    _volume_id,
    _page_id,
    v_expires_at
  );

  insert into public.direct_messages (
    sender_id,
    receiver_id,
    body,
    share_type,
    share_title,
    share_path,
    share_code,
    manga_id,
    volume_id,
    page_id,
    message_kind
  ) values (
    v_user,
    _receiver_id,
    v_message,
    _share_type,
    left(coalesce(_title, 'Compartilhamento'), 200),
    nullif(left(coalesce(_path, ''), 1000), ''),
    v_code,
    _manga_id,
    _volume_id,
    _page_id,
    'share'
  );

  return jsonb_build_object(
    'code', v_code,
    'expires_at', v_expires_at,
    'receiver_id', _receiver_id,
    'share_type', _share_type
  );
end;
$$;

revoke all on function public.share_code_with_friend(uuid, text, text, text, uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.share_code_with_friend(uuid, text, text, text, uuid, uuid, uuid, uuid, text) to authenticated;

-- Importação de código de amigo nunca permite importar obras compradas pelo remetente.
CREATE OR REPLACE FUNCTION public.redeem_friend_share_code(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.friend_share_codes%rowtype; x uuid; cnt integer:=0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login.'; END IF;
 SELECT * INTO c FROM public.friend_share_codes WHERE code=upper(btrim(_code)) FOR UPDATE;
 IF NOT FOUND OR c.recipient_id IS DISTINCT FROM auth.uid()
 OR c.used_at IS NOT NULL OR c.expires_at<=now() THEN RAISE EXCEPTION 'Código inválido.'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(c.manga_ids) w LEFT JOIN public.mangas m ON m.id=w
  WHERE m.id IS NULL OR m.creator_id IS DISTINCT FROM c.sender_id) THEN
 RAISE EXCEPTION 'Compartilhamento não autorizado.'; END IF;
 FOREACH x IN ARRAY c.manga_ids LOOP
 INSERT INTO public.manga_access(user_id,manga_id,granted_by,note)
 VALUES(auth.uid(),x,c.sender_id,'friend-share') ON CONFLICT(user_id,manga_id) DO NOTHING;
 INSERT INTO public.library_items(owner_id,manga_id) VALUES(auth.uid(),x)
 ON CONFLICT(owner_id,manga_id) DO NOTHING;
 cnt:=cnt+1;
 END LOOP;
 UPDATE public.friend_share_codes SET used_at=now(),used_by=auth.uid() WHERE code=c.code;
 RETURN jsonb_build_object('files',cnt,'path',c.share_path,'share_type',c.share_type);
END $$;

-- 14 / REGRAS DO CATÁLOGO DO PROJETO
-- BookSyde: somente contas Admin podem publicar no Catálogo oficial.
-- Marketplace continua disponível para criadores, vendedores e editoras.
create or replace function public.enforce_admin_catalog_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.distribution_channel::text = 'catalog' and new.visibility::text = 'public' then
    if auth.uid() is null or not exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role::text = 'admin'
    ) then
      raise exception 'Somente administradores podem publicar no Catálogo oficial.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mangas_catalog_admin_only on public.mangas;
create trigger trg_mangas_catalog_admin_only
before insert or update of distribution_channel, visibility on public.mangas
for each row execute function public.enforce_admin_catalog_publication();

-- 15 / SUPABASE STORAGE: capas e livros em buckets privados, arquivos de perfil públicos.
-- Limpa somente policies antigas do BookSyde no Storage. Não apaga buckets nem arquivos.
DO $booksyde_storage_cleanup$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname LIKE 'booksyde_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END
$booksyde_storage_cleanup$;
INSERT INTO storage.buckets(id,name,public)
VALUES('avatars','avatars',true),
 ('manga-covers','manga-covers',false),
 ('manga-pages','manga-pages',false),
 ('volume-sources','volume-sources',false),
 ('literary-place-photos','literary-place-photos',false),
 ('donations','donations',true)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY booksyde_avatars_read ON storage.objects FOR SELECT TO anon,authenticated
 USING(bucket_id='avatars');
CREATE POLICY booksyde_avatars_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='avatars' AND split_part(name,'/',1)=auth.uid()::text);
CREATE POLICY booksyde_avatars_update ON storage.objects FOR UPDATE TO authenticated
 USING(bucket_id='avatars' AND split_part(name,'/',1)=auth.uid()::text)
 WITH CHECK(bucket_id='avatars' AND split_part(name,'/',1)=auth.uid()::text);
CREATE POLICY booksyde_avatars_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='avatars' AND split_part(name,'/',1)=auth.uid()::text);
CREATE POLICY booksyde_donations_read ON storage.objects FOR SELECT TO anon,authenticated
 USING(bucket_id='donations');
CREATE POLICY booksyde_donations_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='donations' AND public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY booksyde_donations_update ON storage.objects FOR UPDATE TO authenticated
 USING(bucket_id='donations' AND public.has_role(auth.uid(),'admin'::public.app_role))
 WITH CHECK(bucket_id='donations' AND public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY booksyde_donations_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='donations' AND public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY booksyde_literary_photos_read ON storage.objects FOR SELECT TO anon,authenticated
 USING(bucket_id='literary-place-photos' AND EXISTS(SELECT 1 FROM public.literary_places p
 WHERE p.photo_url LIKE '%'||name||'%'));
CREATE POLICY booksyde_literary_photos_owner_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='literary-place-photos' AND split_part(name,'/',1)=auth.uid()::text);
CREATE POLICY booksyde_literary_photos_owner_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='literary-place-photos' AND split_part(name,'/',1)=auth.uid()::text);
CREATE POLICY booksyde_literary_photos_owner_update ON storage.objects FOR UPDATE TO authenticated
 USING(bucket_id='literary-place-photos' AND split_part(name,'/',1)=auth.uid()::text)
 WITH CHECK(bucket_id='literary-place-photos' AND split_part(name,'/',1)=auth.uid()::text);
CREATE POLICY booksyde_literary_photos_owner_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='literary-place-photos' AND split_part(name,'/',1)=auth.uid()::text);
CREATE POLICY booksyde_cover_public_read ON storage.objects FOR SELECT TO anon,authenticated
 USING(bucket_id='manga-covers' AND EXISTS(SELECT 1 FROM public.mangas m
 WHERE split_part(name,'/',1)=m.id::text AND m.visibility='public'
 AND m.distribution_channel IN('catalog','marketplace')));
CREATE POLICY booksyde_public_sample_read ON storage.objects FOR SELECT TO anon,authenticated
 USING(bucket_id='manga-pages' AND public.is_free_sample_path(name));
CREATE POLICY booksyde_pages_owner_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id IN('manga-pages','volume-sources')
 AND public.can_read_page_path(name,auth.uid()));
CREATE POLICY booksyde_publication_owner_read ON storage.objects FOR SELECT TO authenticated
 USING(public.can_manage_publication_object(bucket_id,name));
CREATE POLICY booksyde_publication_owner_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(public.can_manage_publication_object(bucket_id,name));
CREATE POLICY booksyde_publication_owner_update ON storage.objects FOR UPDATE TO authenticated
 USING(public.can_manage_publication_object(bucket_id,name))
 WITH CHECK(public.can_manage_publication_object(bucket_id,name));
CREATE POLICY booksyde_publication_owner_delete ON storage.objects FOR DELETE TO authenticated
 USING(public.can_manage_publication_object(bucket_id,name));


-- 15.5 / HARDENING PARA CONTEÚDO LICENCIADO + DADOS SIGILOSOS + PERFORMANCE
-- Objetivos:
--   1) manter originais/páginas de livros em buckets privados;
--   2) reduzir enumeração/vazamento de caminhos internos e credenciais de cobrança;
--   3) acelerar RLS, catálogo, biblioteca, leitura, pedidos e busca;
--   4) bloquear alterações de colunas sensíveis pelo cliente mesmo quando uma tabela é atualizável.
-- IMPORTANTE: URLs assinadas de arquivos licenciados devem ser curtas (recomendado: 60-300 s)
-- e emitidas no backend/Edge Function depois de validar can_access_manga(). Nunca grave URL assinada no banco.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- RLS também é forçado nas tabelas mais sensíveis. service_role continua com BYPASSRLS.
ALTER TABLE public.profile_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.purchases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_delivery_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.friend_share_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.library_share_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.manga_access FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.volumes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.content_removals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

-- O cliente nunca deve alterar identidade financeira, direitos/licenças ou caminhos de arquivo
-- diretamente. Operações legítimas passam por RPCs SECURITY DEFINER já validadas ou service_role.
REVOKE UPDATE (stripe_customer_id,provider_ref,provider,price_id,environment,status,current_period_end)
 ON public.subscriptions FROM authenticated;
REVOKE UPDATE (provider_ref,provider,status,amount_cents,user_id,manga_id)
 ON public.purchases FROM authenticated;
REVOKE UPDATE (checkout_session_id,checkout_url,paid_at,stripe_account_id,stripe_environment,
 status,total_cents,buyer_id,seller_id,fulfillment_status)
 ON public.marketplace_orders FROM authenticated;
REVOKE UPDATE (rights_basis,rights_confirmed_at,terms_accepted_at,terms_version,licensed_purchase_url,
 licensed_store_name,distribution_channel,visibility,catalog_sale_enabled,price_cents,invite_token)
 ON public.mangas FROM authenticated;
REVOKE UPDATE (source_path,source_name,source_size,source_type,file_format,manga_id)
 ON public.volumes FROM authenticated;
REVOKE UPDATE (storage_path,volume_id,page_index) ON public.pages FROM authenticated;

-- Metadados internos não podem ser protegidos com REVOKE por coluna enquanto existir GRANT SELECT
-- da tabela inteira. Por isso removemos o SELECT amplo e concedemos somente colunas seguras.
-- Isso é intencionalmente mais rígido: telas antigas que fazem select('*') nessas tabelas devem
-- migrar para as RPCs/views enxutas abaixo.
REVOKE SELECT ON public.mangas,public.volumes,public.pages FROM anon,authenticated;
GRANT SELECT (id,author,category,catalog_sale_enabled,cover_url,created_at,creator_id,currency,description,
 genres,is_collection,price_cents,slug,status,synopsis,title,view_count,visibility,work_type,distribution_channel)
 ON public.mangas TO anon,authenticated;
GRANT SELECT (id,cover_url,created_at,file_format,manga_id,number,page_count,published,title,unit_kind)
 ON public.volumes TO anon,authenticated;
-- storage_path é segredo operacional para conteúdo licenciado. O cliente recebe apenas id/índice.
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

-- Índices direcionados às verificações de autorização (RLS/RPC).
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles(user_id,role);
CREATE INDEX IF NOT EXISTS idx_manga_access_user_manga ON public.manga_access(user_id,manga_id);
CREATE INDEX IF NOT EXISTS idx_purchases_completed_user_manga
 ON public.purchases(user_id,manga_id) WHERE status='completed';
CREATE INDEX IF NOT EXISTS idx_mangas_public_catalog_recent
 ON public.mangas(created_at DESC,id)
 WHERE visibility='public' AND distribution_channel='catalog';
CREATE INDEX IF NOT EXISTS idx_mangas_creator_id ON public.mangas(creator_id,id);
CREATE INDEX IF NOT EXISTS idx_volumes_published_manga_number
 ON public.volumes(manga_id,number,id) WHERE published=true;
CREATE INDEX IF NOT EXISTS idx_pages_storage_path ON public.pages(storage_path);
CREATE INDEX IF NOT EXISTS idx_volumes_source_path ON public.volumes(source_path) WHERE source_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketplace_active_recent
 ON public.marketplace_listings(created_at DESC,id) WHERE active=true AND moderation_status='active';
CREATE INDEX IF NOT EXISTS idx_marketplace_seller_active
 ON public.marketplace_listings(seller_id,created_at DESC) WHERE active=true;
CREATE INDEX IF NOT EXISTS idx_marketplace_listing_manga_id
 ON public.marketplace_listings(manga_id) WHERE manga_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer_status_recent
 ON public.marketplace_orders(buyer_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller_status_recent
 ON public.marketplace_orders(seller_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.marketplace_order_items(order_id,id);
CREATE INDEX IF NOT EXISTS idx_delivery_codes_order ON public.marketplace_delivery_codes(order_id);
CREATE INDEX IF NOT EXISTS idx_library_items_owner_position ON public.library_items(owner_id,folder_id,position);
CREATE INDEX IF NOT EXISTS idx_library_folders_owner_recent ON public.library_folders(owner_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user_recent ON public.manga_favorites(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_recent ON public.marketplace_wishlist(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_volume ON public.page_bookmarks(user_id,volume_id,page_index);
CREATE INDEX IF NOT EXISTS idx_reading_time_user_date ON public.reading_time_daily(user_id,reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread
 ON public.direct_messages(receiver_id,created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_friendships_pending_addressee
 ON public.friendships(addressee_id,created_at DESC) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_friendships_accepted_requester
 ON public.friendships(requester_id,addressee_id) WHERE status='accepted';
CREATE INDEX IF NOT EXISTS idx_friendships_accepted_addressee
 ON public.friendships(addressee_id,requester_id) WHERE status='accepted';
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm
 ON public.profiles USING gin (lower(display_name) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_user_code_lower
 ON public.profiles(lower(user_code)) WHERE user_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_manga_recent ON public.reviews(manga_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_manga_recent ON public.comments(manga_id,created_at DESC);

-- Arrays usados pelo marketplace precisam de GIN para evitar varredura completa em ANY/containment.
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_manga_ids_gin
 ON public.marketplace_listings USING gin (manga_ids);

-- Busca de leitores reescrita para aproveitar pg_trgm e evitar custo desnecessário.
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
 v_like := '%' || replace(replace(replace(lower(v_query),'\\','\\\\'),'%','\\%'),'_','\\_') || '%';
 RETURN QUERY
 SELECT p.id,p.display_name::text,p.avatar_url::text,p.user_code::text
 FROM public.profiles p
 WHERE p.id<>v_user AND (
   lower(coalesce(p.user_code,''))=lower(v_query)
   OR lower(p.display_name) LIKE v_like ESCAPE '\\'
 )
 ORDER BY CASE WHEN lower(coalesce(p.user_code,''))=lower(v_query) THEN 0
               WHEN lower(p.display_name)=lower(v_query) THEN 1 ELSE 2 END,
          p.display_name,p.id
 LIMIT greatest(1,least(coalesce(_max_results,12),12));
END $$;

-- API enxuta para catálogo: retorna só o que a vitrine precisa, sem direitos, tokens ou caminhos internos.
CREATE OR REPLACE FUNCTION public.get_catalog_page(
 _limit integer DEFAULT 24,
 _cursor_created_at timestamptz DEFAULT NULL,
 _cursor_id uuid DEFAULT NULL,
 _work_type text DEFAULT NULL,
 _search text DEFAULT NULL
)
RETURNS TABLE(
 id uuid,slug text,title text,author text,category text,genres text[],work_type text,
 cover_url text,synopsis text,price_cents integer,currency text,created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.id,m.slug,m.title,m.author,m.category,m.genres,m.work_type,m.cover_url,
        m.synopsis,m.price_cents,m.currency,m.created_at
 FROM public.mangas m
 WHERE m.visibility='public' AND m.distribution_channel='catalog'
   AND (_work_type IS NULL OR m.work_type=_work_type)
   AND (_search IS NULL OR btrim(_search)='' OR
        lower(m.title) LIKE '%'||lower(left(btrim(_search),80))||'%' OR
        lower(m.author) LIKE '%'||lower(left(btrim(_search),80))||'%')
   AND (_cursor_created_at IS NULL OR (m.created_at,m.id)<(_cursor_created_at,coalesce(_cursor_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
 ORDER BY m.created_at DESC,m.id DESC
 LIMIT greatest(1,least(coalesce(_limit,24),60));
$$;

-- Manifesto de leitura: não retorna storage_path. O front recebe IDs/índices e pede a URL
-- temporária ao backend/Edge Function, que deve validar o volume e assinar o objeto.
CREATE OR REPLACE FUNCTION public.get_reader_manifest(_volume_id uuid)
RETURNS TABLE(page_id uuid,page_index integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id,p.page_index
 FROM public.pages p
 JOIN public.volumes v ON v.id=p.volume_id
 WHERE p.volume_id=_volume_id
   AND (public.can_access_manga(auth.uid(),v.manga_id) OR public.can_manage_publication(v.manga_id))
 ORDER BY p.page_index;
$$;

-- Função server-side para resolver o caminho somente depois da autorização.
-- NÃO conceder a authenticated/anon. Use apenas service_role em Edge Function/backend.
CREATE OR REPLACE FUNCTION public.resolve_page_storage_path(_user_id uuid,_page_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.storage_path
 FROM public.pages p JOIN public.volumes v ON v.id=p.volume_id JOIN public.mangas m ON m.id=v.manga_id
 WHERE p.id=_page_id AND (
   m.creator_id=_user_id
   OR public.has_role(_user_id,'admin'::public.app_role)
   OR EXISTS(SELECT 1 FROM public.manga_access ma WHERE ma.user_id=_user_id AND ma.manga_id=m.id)
   OR EXISTS(SELECT 1 FROM public.purchases pu WHERE pu.user_id=_user_id AND pu.manga_id=m.id AND pu.status='completed')
   OR (m.visibility='public' AND m.distribution_channel='catalog' AND m.price_cents=0)
 )
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_page_storage_path(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_page_storage_path(uuid,uuid) TO service_role;

-- Função equivalente para o arquivo-fonte do volume. Nunca entregue source_path diretamente ao navegador.
CREATE OR REPLACE FUNCTION public.resolve_volume_source_path(_user_id uuid,_volume_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT v.source_path
 FROM public.volumes v JOIN public.mangas m ON m.id=v.manga_id
 WHERE v.id=_volume_id AND (
   m.creator_id=_user_id
   OR public.has_role(_user_id,'admin'::public.app_role)
   OR EXISTS(SELECT 1 FROM public.manga_access ma WHERE ma.user_id=_user_id AND ma.manga_id=m.id)
   OR EXISTS(SELECT 1 FROM public.purchases pu WHERE pu.user_id=_user_id AND pu.manga_id=m.id AND pu.status='completed')
 )
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_volume_source_path(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_volume_source_path(uuid,uuid) TO service_role;

-- Estatísticas atualizadas ajudam o planner/PostgREST a escolher os índices novos.
ANALYZE public.mangas;
ANALYZE public.volumes;
ANALYZE public.pages;
ANALYZE public.purchases;
ANALYZE public.manga_access;
ANALYZE public.marketplace_listings;
ANALYZE public.marketplace_orders;
ANALYZE public.marketplace_order_items;
ANALYZE public.library_items;
ANALYZE public.direct_messages;
ANALYZE public.friendships;
ANALYZE public.profiles;

-- 16 / REVOGAR EXECUÇÃO IMPLÍCITA DE FUNÇÕES E EXPLICITAR A API CLIENTE
-- Segurança: SQL FUNCTIONS recebem EXECUTE para PUBLIC por padrão!
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
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
-- As views têm proprietário postgres; expõem apenas dados destinados ao público.
-- Remova o acesso a marketplace_catalog se não desejar divulgar catálogo sem login.
NOTIFY pgrst,'reload schema';
COMMIT;

-- 17 / DIAGNÓSTICO DE INSTALAÇÃO: resultado esperado 43 tabelas public e 6 buckets.
SELECT (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN (
  'bookmark_collections', 'comments', 'content_removals', 'demo_accounts', 'demo_dashboard', 'demo_dashboard_access', 'demo_dashboard_countries', 'demo_dashboard_revenue', 'direct_messages', 'friend_share_codes', 'friendships',
  'library_folders', 'library_items', 'library_share_codes', 'literary_place_confirmations', 'literary_place_reviews', 'literary_places', 'manga_access', 'manga_favorites', 'mangas', 'marketplace_delivery_codes', 'marketplace_listings',
  'marketplace_order_items', 'marketplace_orders', 'marketplace_refund_requests', 'marketplace_reports', 'marketplace_sellers', 'marketplace_wishlist', 'page_bookmarks', 'pages', 'profile_contacts', 'profiles', 'purchases',
  'reading_progress', 'reading_time_daily', 'reviews', 'site_settings', 'subscriptions', 'support_requests', 'system_access_daily', 'system_access_state', 'user_roles', 'volumes') ) AS tabelas_booksyde,
       (SELECT count(*) FROM storage.buckets WHERE id IN ('avatars','manga-covers',
           'manga-pages','volume-sources','literary-place-photos','donations')) AS buckets_booksyde,
       (SELECT count(*) FROM public.profiles) AS perfis_criados;
