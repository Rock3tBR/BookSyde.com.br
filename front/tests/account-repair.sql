-- Apenas banco vazio e descartável: psql -v ON_ERROR_STOP=1 -f tests/account-repair.sql
\set ON_ERROR_STOP on
\ir fixtures/account-repair.sql
CREATE FUNCTION pg_temp.assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion: %', message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%' || message || '%' THEN RETURN; END IF; RAISE; END;
  RAISE EXCEPTION 'Expected failure: %', statement;
END $$;

INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001','buyer@example.invalid','{"display_name":"Nome preservado"}');
-- Conta histórica sem perfil/role e gatilho sem SECURITY DEFINER.
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000002','missing@example.invalid','{}');
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
ALTER FUNCTION public.handle_new_user() SECURITY INVOKER;
SET ROLE supabase_auth_admin;
SELECT pg_temp.expect_error($q$INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000003','admin@example.invalid','{}')$q$,'permission denied');
RESET ROLE;
SELECT pg_temp.expect_error($q$UPDATE profiles SET theme='forest' WHERE id='00000000-0000-0000-0000-000000000001'$q$,'profiles_theme_check');
SELECT pg_temp.expect_error($q$UPDATE profiles SET book_display_style='realistic' WHERE id='00000000-0000-0000-0000-000000000001'$q$,'profiles_book_display_style_check');

\ir ../sql/repair/00_diagnostico.sql
\ir ../sql/repair/01_cadastro_preferencias.sql
SELECT pg_temp.assert((SELECT count(*)=2 FROM profiles),'backfill missing profile');
SELECT pg_temp.assert((SELECT count(*)=2 FROM user_roles),'backfill missing role');
SET ROLE supabase_auth_admin;
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000003','admin@example.invalid','{"display_name":"Vendedor","role":"admin"}');
RESET ROLE;
SELECT pg_temp.assert(NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id='00000000-0000-0000-0000-000000000003' AND role='admin'),'metadata cannot grant admin');
SELECT pg_temp.assert((SELECT display_name='Vendedor' FROM profiles WHERE id='00000000-0000-0000-0000-000000000003'),'signup creates profile');
INSERT INTO user_roles(user_id,role) VALUES ('00000000-0000-0000-0000-000000000003','admin');

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SET ROLE authenticated;
UPDATE profiles SET theme='forest', manga_display_style='realistic', hq_display_style='realistic',
  gibi_display_style='realistic', book_display_style='realistic', reading_direction='book',
  page_transition='instant', visible_work_types=ARRAY['book'], site_onboarding_completed=true,
  continue_reading_preview='page', reader_brightness=80, reader_background='sepia',
  page_turn_speed='fast', progress_style='minimal', hide_reader_comments=true,
  data_saver=true, auto_next_volume=false, show_progress=true
WHERE id=auth.uid();
UPDATE profiles SET display_name='INVASOR' WHERE id='00000000-0000-0000-0000-000000000002';
INSERT INTO profile_contacts(user_id,phone_e164) VALUES(auth.uid(),'+5511999999999');
SELECT pg_temp.expect_error($q$INSERT INTO profile_contacts(user_id,phone_e164) VALUES('00000000-0000-0000-0000-000000000002','+5511999999999')$q$,'row-level security');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SELECT pg_temp.assert((SELECT count(*)=0 FROM profile_contacts),'contacts stay private');
RESET ROLE;
SELECT pg_temp.assert((SELECT display_name='missing' FROM profiles WHERE id='00000000-0000-0000-0000-000000000002'),'cannot update another profile');
\ir ../sql/repair/01_cadastro_preferencias.sql
SELECT pg_temp.assert((SELECT display_name='Nome preservado' AND theme='forest' AND book_display_style='realistic' FROM profiles WHERE id='00000000-0000-0000-0000-000000000001'),'rerun preserves preferences and name');

\ir ../sql/repair/02_compras.sql
CREATE TEMP TABLE rpc_before AS SELECT oid, prosrc FROM pg_proc WHERE oid IN (
  'public.create_catalog_order_server(uuid,uuid,text)'::regprocedure,
  'public.create_marketplace_order_server(uuid,uuid[],text)'::regprocedure);
\ir ../sql/repair/02_compras.sql
SELECT pg_temp.assert((SELECT bool_and(p.prosrc=b.prosrc) FROM rpc_before b JOIN pg_proc p ON p.oid=b.oid),'rerun preserves installed RPCs');
SELECT pg_temp.assert(NOT has_function_privilege('anon','public.create_catalog_order_server(uuid,uuid,text)','EXECUTE'),'anon cannot create orders');
SELECT pg_temp.assert(NOT has_function_privilege('authenticated','public.fulfill_marketplace_order(uuid,text)','EXECUTE'),'client cannot confirm payment');
SET ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT create_catalog_order_server('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','live')$q$,'permission denied');
SELECT pg_temp.expect_error($q$SELECT create_marketplace_order_server('00000000-0000-0000-0000-000000000001',ARRAY[]::uuid[],'live')$q$,'permission denied');
RESET ROLE;

INSERT INTO mangas(id,creator_id,title,price_cents) VALUES
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','Livro catálogo',1990),
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Livro criador',2500);
INSERT INTO marketplace_listings(id,seller_id,target_type,manga_id,title,manga_ids,price_cents) VALUES
  ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','manga','10000000-0000-0000-0000-000000000001','Livro catálogo',ARRAY['10000000-0000-0000-0000-000000000001']::uuid[],1990),
  ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','manga','10000000-0000-0000-0000-000000000002','Livro criador',ARRAY['10000000-0000-0000-0000-000000000002']::uuid[],2500);
SET ROLE service_role;
SELECT create_catalog_order_server('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','live')->>'order_id' AS catalog_order \gset
SELECT pg_temp.expect_error($q$SELECT create_catalog_order_server('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',NULL)$q$,'Ambiente');
SELECT pg_temp.expect_error($q$SELECT create_catalog_order_server('00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','live')$q$,'própria obra');
SELECT pg_temp.expect_error($q$SELECT create_catalog_order_server('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','live')$q$,'administrador responsável');
SELECT create_marketplace_order_server('00000000-0000-0000-0000-000000000001',ARRAY['20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001']::uuid[],'live');
SELECT pg_temp.expect_error($q$SELECT create_marketplace_order_server('00000000-0000-0000-0000-000000000001',ARRAY['20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002']::uuid[],'live')$q$,'um vendedor');
SELECT pg_temp.expect_error($q$SELECT create_marketplace_order_server('00000000-0000-0000-0000-000000000001',ARRAY['20000000-0000-0000-0000-000000000002']::uuid[],'live')$q$,'receber pagamentos');
INSERT INTO marketplace_sellers(user_id,stripe_sandbox_account_id,sandbox_charges_enabled)
VALUES('00000000-0000-0000-0000-000000000002','acct_fixture',true);
SELECT create_marketplace_order_server('00000000-0000-0000-0000-000000000001',ARRAY['20000000-0000-0000-0000-000000000002']::uuid[],'sandbox');
SELECT pg_temp.expect_error($q$SELECT create_marketplace_order_server('00000000-0000-0000-0000-000000000001',ARRAY['20000000-0000-0000-0000-000000000002']::uuid[],'live')$q$,'receber pagamentos');
RESET ROLE;
SELECT pg_temp.assert((SELECT count(*)=3 AND bool_and(status='pending') FROM marketplace_orders),'only valid orders are created and none is paid');
SELECT pg_temp.assert((SELECT count(*)=3 FROM marketplace_order_items),'duplicate listing billed once');
SELECT pg_temp.assert((SELECT count(*)=3 FROM direct_messages),'one chat message per valid order');
SELECT pg_temp.assert((SELECT bool_and(o.total_cents=s.total) FROM marketplace_orders o JOIN (SELECT order_id,sum(price_cents) total FROM marketplace_order_items GROUP BY order_id) s ON s.order_id=o.id),'totals come from database snapshots');
SELECT pg_temp.assert((SELECT count(*)=0 FROM purchases) AND (SELECT count(*)=0 FROM manga_access),'order creation grants no access');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SET ROLE authenticated;
SELECT pg_temp.assert((SELECT count(*)=1 FROM marketplace_orders),'seller only sees participated orders');
SELECT pg_temp.expect_error($q$UPDATE marketplace_orders SET status='paid'$q$,'permission denied');
RESET ROLE;
\ir ../sql/repair/00_diagnostico.sql
\echo 'Account/preferences and pending-order contract tests passed. Stripe delivery not exercised.'
