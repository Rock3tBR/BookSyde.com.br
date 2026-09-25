-- Run only against an empty, disposable PostgreSQL database:
-- psql -v ON_ERROR_STOP=1 -f tests/library-folders.sql
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO authenticated, anon;
CREATE TABLE public.mangas(id uuid PRIMARY KEY, creator_id uuid, visibility text, slug text, title text, author text, cover_url text, genres text[], price_cents int, currency text, work_type text, view_count int);
-- Deliberately omit manga_access and can_access_manga: reproduce the SQL Editor failure.
CREATE FUNCTION public.has_role(uuid, text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
\ir ../supabase/migrations/20260910170000_library_folders.sql
-- A second execution must preserve the schema and installed helper.
\ir ../supabase/migrations/20260910170000_library_folders.sql
CREATE FUNCTION pg_temp.assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%', message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%' || message || '%' THEN RETURN; END IF; RAISE; END;
 RAISE EXCEPTION 'Expected failure: %', statement;
END $$;
INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
INSERT INTO mangas(id, creator_id, visibility, title) SELECT ('10000000-0000-0000-0000-00000000000' || n)::uuid, '00000000-0000-0000-0000-000000000001', 'private', 'Livro ' || n FROM generate_series(1,3) n;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT save_library_folder('Meus estudos', ARRAY(SELECT ('10000000-0000-0000-0000-00000000000' || n)::uuid FROM generate_series(1,3) n)) AS folder \gset
SELECT generate_library_share(:'folder') ->> 'code' AS code \gset
SELECT pg_temp.assert((SELECT expires_at BETWEEN now() + interval '11 hours 59 minutes' AND now() + interval '12 hours 1 minute' FROM library_share_codes WHERE code = :'code'), '12 hour expiry');
SELECT pg_temp.expect_error(format('SELECT redeem_library_share(%L, true)', :'code'), 'outra pessoa');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
SELECT pg_temp.assert((SELECT count(*) = 0 FROM library_share_codes), 'Codes must be creator-only');
SELECT pg_temp.expect_error(format('SELECT generate_library_share(%L)', :'folder'), 'criador');
SELECT pg_temp.expect_error(format('SELECT save_library_folder(%L, ARRAY[]::uuid[], %L)', 'Hack', :'folder'), 'não encontrada');
SELECT redeem_library_share(:'code', true) ->> 'folder_id' AS imported \gset
SELECT pg_temp.assert((SELECT count(*) = 1 FROM library_folders), 'One imported folder');
SELECT pg_temp.assert((SELECT count(*) = 3 FROM library_items WHERE folder_id = :'imported'), 'Folder has all three books');
SELECT pg_temp.assert(jsonb_array_length(get_library_workspace()->'codes') = 0, 'Imported folder never exposes source code');
SELECT pg_temp.expect_error(format('SELECT generate_library_share(%L)', :'imported'), 'criador');
SELECT pg_temp.expect_error(format('SELECT redeem_library_share(%L, false)', :'code'), 'já utilizado');
SELECT pg_temp.assert(can_access_manga(auth.uid(), '10000000-0000-0000-0000-000000000001'), 'Recipient can read shared private book');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT generate_library_share(:'folder') ->> 'code' AS old_code \gset
SELECT generate_library_share(:'folder') ->> 'code' AS content_code \gset
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
SELECT pg_temp.expect_error(format('SELECT redeem_library_share(%L, false)', :'old_code'), 'expirado');
SELECT redeem_library_share(:'content_code', false);
SELECT pg_temp.assert((SELECT count(*) = 0 FROM library_folders), 'Contents only creates no folder');
SELECT pg_temp.assert((SELECT count(*) = 3 FROM library_items WHERE folder_id IS NULL), 'Contents at root');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT generate_library_share(:'folder') ->> 'code' AS duplicate_code \gset
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
SELECT redeem_library_share(:'duplicate_code', false);
SELECT pg_temp.assert((SELECT count(*) = 3 FROM library_items), 'Import is deduplicated');
RESET ROLE;
-- Reapplying with real folders, items and redeemed codes must preserve all data.
\ir ../supabase/migrations/20260910170000_library_folders.sql
SELECT pg_temp.assert((SELECT count(*) = 2 FROM library_folders), 'Rerun preserves folders');
SELECT pg_temp.assert((SELECT count(*) = 9 FROM library_items), 'Rerun preserves items');
SELECT pg_temp.assert((SELECT count(*) = 3 FROM library_share_codes WHERE used_at IS NOT NULL), 'Rerun preserves used codes');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT generate_library_share(:'folder') ->> 'code' AS expired_code \gset
UPDATE library_share_codes SET expires_at = now() - interval '1 second' WHERE code = :'expired_code';
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error(format('SELECT redeem_library_share(%L, false)', :'expired_code'), 'expirado');
SELECT pg_temp.expect_error('INSERT INTO library_folders(owner_id, creator_id, name) VALUES(auth.uid(), auth.uid(), ''Bypass'')', 'permission denied');
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT pg_temp.expect_error('SELECT redeem_library_share(''bad'', false)', 'Entre');
RESET ROLE;
\ir ../supabase/migrations/20260910180000_library_folder_appearance.sql
\ir ../supabase/migrations/20260910180000_library_folder_appearance.sql
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT save_library_folder('Meus estudos', ARRAY['10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002']::uuid[], '#ABCDEF', :'folder');
SELECT pg_temp.assert((SELECT color = '#abcdef' FROM library_folders WHERE id = :'folder'), 'Saved color');
SELECT pg_temp.assert(get_library_workspace()->'items'->0->'manga'->>'id' = '10000000-0000-0000-0000-000000000003', 'First item has deterministic order');
SELECT pg_temp.expect_error(format('SELECT save_library_folder(%L, ARRAY[]::uuid[], %L)', 'Bad color', 'red'), 'cor válida');
SELECT generate_library_share(:'folder')->>'code' AS custom_code \gset
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
SELECT pg_temp.expect_error(format('SELECT redeem_library_share(%L, true, %L, %L)', :'custom_code', ' ', '#32a875'), 'nome');
SELECT pg_temp.expect_error(format('SELECT redeem_library_share(%L, true, %L, %L)', :'custom_code', 'Minha coleção', 'invalid'), 'cor válida');
SELECT redeem_library_share(:'custom_code', true, 'Minha coleção', '#32a875')->>'folder_id' AS custom_folder \gset
SELECT pg_temp.assert((SELECT name = 'Minha coleção' AND color = '#32a875' FROM library_folders WHERE id = :'custom_folder'), 'Import uses custom name and color');
SELECT pg_temp.assert((SELECT manga_id = '10000000-0000-0000-0000-000000000003' FROM library_items WHERE folder_id = :'custom_folder' ORDER BY position LIMIT 1), 'Imported first item preserves order');
SELECT pg_temp.expect_error(format('SELECT redeem_library_share(%L, true, %L, %L)', :'custom_code', 'Again', '#32a875'), 'já utilizado');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT pg_temp.assert((SELECT name = 'Meus estudos' AND color = '#abcdef' FROM library_folders WHERE id = :'folder'), 'Source appearance unchanged');
SELECT generate_library_share(:'folder')->>'code' AS flat_code \gset
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
SELECT redeem_library_share(:'flat_code', false, NULL, NULL);
SELECT pg_temp.assert((SELECT count(*) = 0 FROM library_folders), 'Contents only needs no folder fields');
ROLLBACK;
\echo 'Library database assertions passed.'
