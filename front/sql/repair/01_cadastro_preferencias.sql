-- BookSyde: reparo de cadastro e preferências para o esquema existente.
-- Execute inteiro no SQL Editor como postgres. Não execute pedaços isolados.
-- Não é uma instalação do banco do zero. Qualquer erro desfaz este arquivo.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.user_roles') IS NULL THEN
    RAISE EXCEPTION 'Faltam profiles/user_roles. Execute 00_diagnostico.sql antes de reparar.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role' AND e.enumlabel = 'user'
  ) THEN
    RAISE EXCEPTION 'O enum public.app_role não possui user. O esquema precisa ser analisado.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'auth.users'::regclass
      AND t.tgname = 'on_auth_user_created'
      AND t.tgfoid IS DISTINCT FROM to_regprocedure('public.handle_new_user()')
  ) THEN
    RAISE EXCEPTION 'O gatilho de cadastro foi customizado. Revise sua definição antes de substituir.';
  END IF;
  -- Aceita apenas o corpo original recuperado do Git ou o corpo deste reparo.
  -- Não substitui silenciosamente regras de cadastro adicionadas em produção.
  IF EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.handle_new_user()')
      AND md5(regexp_replace(p.prosrc, '\s+', '', 'g')) NOT IN (
        'a5186c50b7553bc39bd1d4cf297a7a86', '639fb977a30f91ece8a270c167cdba2f'
      )
  ) THEN
    RAISE EXCEPTION 'handle_new_user contém uma implementação diferente do histórico. Preserve-a e envie sua definição para análise.';
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reading_direction text NOT NULL DEFAULT 'manga',
  ADD COLUMN IF NOT EXISTS page_transition text NOT NULL DEFAULT 'page_turn',
  ADD COLUMN IF NOT EXISTS reader_onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS site_onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visible_work_types text[] NOT NULL DEFAULT ARRAY['manga','hq','gibi','book'],
  ADD COLUMN IF NOT EXISTS show_progress boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS reader_brightness integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS reader_background text NOT NULL DEFAULT 'black',
  ADD COLUMN IF NOT EXISTS page_turn_speed text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS progress_style text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS hide_reader_comments boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_saver boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_next_volume boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS continue_reading_preview text NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS manga_display_style text NOT NULL DEFAULT 'grid',
  ADD COLUMN IF NOT EXISTS hq_display_style text NOT NULL DEFAULT 'grid',
  ADD COLUMN IF NOT EXISTS gibi_display_style text NOT NULL DEFAULT 'grid',
  ADD COLUMN IF NOT EXISTS book_display_style text NOT NULL DEFAULT 'grid';

-- Amplia somente as restrições conhecidas das migrações originais.
-- NOT VALID preserva valores antigos fora da lista; novas gravações são validadas.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_theme_check,
  DROP CONSTRAINT IF EXISTS profiles_manga_display_style_check,
  DROP CONSTRAINT IF EXISTS profiles_hq_display_style_check,
  DROP CONSTRAINT IF EXISTS profiles_gibi_display_style_check,
  DROP CONSTRAINT IF EXISTS profiles_book_display_style_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_check
    CHECK (theme IN ('light','vanilla','latte','cappuccino','mocha','coffee','dark','midnight')) NOT VALID,
  ADD CONSTRAINT profiles_manga_display_style_check
    CHECK (manga_display_style IN ('grid','book','showcase','realistic')) NOT VALID,
  ADD CONSTRAINT profiles_hq_display_style_check
    CHECK (hq_display_style IN ('grid','book','showcase','realistic')) NOT VALID,
  ADD CONSTRAINT profiles_gibi_display_style_check
    CHECK (gibi_display_style IN ('grid','book','showcase','realistic')) NOT VALID,
  ADD CONSTRAINT profiles_book_display_style_check
    CHECK (book_display_style IN ('grid','book','showcase','realistic')) NOT VALID;

-- Defaults também são necessários quando a coluna já existia sem default.
-- Não altera personalizações, nomes, códigos ou papéis de contas existentes.
ALTER TABLE public.profiles
  ALTER COLUMN display_name SET DEFAULT 'Leitor',
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN reading_direction SET DEFAULT 'manga',
  ALTER COLUMN page_transition SET DEFAULT 'page_turn',
  ALTER COLUMN reader_onboarding_completed SET DEFAULT false,
  ALTER COLUMN site_onboarding_completed SET DEFAULT false,
  ALTER COLUMN visible_work_types SET DEFAULT ARRAY['manga','hq','gibi','book'],
  ALTER COLUMN show_progress SET DEFAULT true,
  ALTER COLUMN theme SET DEFAULT 'dark',
  ALTER COLUMN reader_brightness SET DEFAULT 100,
  ALTER COLUMN reader_background SET DEFAULT 'black',
  ALTER COLUMN page_turn_speed SET DEFAULT 'normal',
  ALTER COLUMN progress_style SET DEFAULT 'full',
  ALTER COLUMN hide_reader_comments SET DEFAULT false,
  ALTER COLUMN data_saver SET DEFAULT false,
  ALTER COLUMN auto_next_volume SET DEFAULT true,
  ALTER COLUMN continue_reading_preview SET DEFAULT 'cover',
  ALTER COLUMN manga_display_style SET DEFAULT 'grid',
  ALTER COLUMN hq_display_style SET DEFAULT 'grid',
  ALTER COLUMN gibi_display_style SET DEFAULT 'grid',
  ALTER COLUMN book_display_style SET DEFAULT 'grid';

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles, public.user_roles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);

-- Restaura o contrato original: perfil e papel comum; nunca usa metadata.role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(id, display_name)
  VALUES (
    NEW.id,
    coalesce(nullif(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
             nullif(split_part(NEW.email, '@', 1), ''), 'Leitor')
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles(user_id, role)
  VALUES (NEW.id, 'user'::public.app_role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Recupera perfis ausentes, sem sobrescrever perfis já existentes.
INSERT INTO public.profiles(id, display_name)
SELECT u.id, coalesce(nullif(btrim(u.raw_user_meta_data->>'display_name'), ''),
                      nullif(split_part(u.email, '@', 1), ''), 'Leitor')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles(user_id, role)
SELECT u.id, 'user'::public.app_role FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT DO NOTHING;

-- Telefone privado, conforme o fluxo de Meu perfil.
CREATE TABLE IF NOT EXISTS public.profile_contacts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164 text CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_contacts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_contacts TO authenticated;
DROP POLICY IF EXISTS profile_contacts_read_own ON public.profile_contacts;
CREATE POLICY profile_contacts_read_own ON public.profile_contacts FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS profile_contacts_insert_own ON public.profile_contacts;
CREATE POLICY profile_contacts_insert_own ON public.profile_contacts FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS profile_contacts_update_own ON public.profile_contacts;
CREATE POLICY profile_contacts_update_own ON public.profile_contacts FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS profile_contacts_delete_own ON public.profile_contacts;
CREATE POLICY profile_contacts_delete_own ON public.profile_contacts FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'Cadastro e preferências: script concluído. Valide cadastro e salvamento no aplicativo.' AS resultado;
