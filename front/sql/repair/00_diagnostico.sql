-- Somente leitura. Não retorna emails, telefones, tokens ou conteúdo de pedidos.
-- Execute antes dos reparos; guarde o resultado se qualquer script falhar.
WITH expected_tables(name) AS (VALUES
  ('profiles'), ('user_roles'), ('profile_contacts'), ('mangas'), ('volumes'),
  ('marketplace_sellers'), ('marketplace_listings'), ('marketplace_orders'),
  ('marketplace_order_items'), ('marketplace_delivery_codes'), ('direct_messages'),
  ('purchases'), ('manga_access'), ('library_folders'), ('library_items')
), expected_functions(signature, server_only) AS (VALUES
  ('public.handle_new_user()', true),
  ('public.create_catalog_order_server(uuid,uuid,text)', true),
  ('public.create_marketplace_order_server(uuid,uuid[],text)', true),
  ('public.fulfill_marketplace_order(uuid,text)', true),
  ('public.get_marketplace_order_details(uuid)', false),
  ('public.redeem_marketplace_order(uuid)', false),
  ('public.redeem_marketplace_code(text)', false)
), expected_preferences(name) AS (VALUES
  ('avatar_url'), ('reading_direction'), ('page_transition'),
  ('reader_onboarding_completed'), ('site_onboarding_completed'), ('visible_work_types'),
  ('show_progress'), ('theme'), ('reader_brightness'), ('reader_background'),
  ('page_turn_speed'), ('progress_style'), ('hide_reader_comments'), ('data_saver'),
  ('auto_next_volume'), ('continue_reading_preview'), ('manga_display_style'),
  ('hq_display_style'), ('gibi_display_style'), ('book_display_style')
), report AS (
  SELECT 'tabela' AS tipo, 'public.' || e.name AS objeto,
    jsonb_build_object('existe', c.oid IS NOT NULL, 'rls', c.relrowsecurity,
      'leitura_authenticated', CASE WHEN c.oid IS NOT NULL THEN has_table_privilege('authenticated',c.oid,'SELECT') END) AS detalhes
  FROM expected_tables e LEFT JOIN pg_class c ON c.oid = to_regclass('public.' || e.name)
  UNION ALL
  SELECT 'rpc', e.signature,
    jsonb_build_object('existe', p.oid IS NOT NULL,
      'argumentos', pg_get_function_arguments(p.oid), 'retorno', pg_get_function_result(p.oid),
      'somente_servidor_esperado', e.server_only, 'security_definer', p.prosecdef,
      'dono', pg_get_userbyid(p.proowner), 'config', p.proconfig,
      'execute_anon', CASE WHEN p.oid IS NOT NULL THEN has_function_privilege('anon',p.oid,'EXECUTE') END,
      'execute_authenticated', CASE WHEN p.oid IS NOT NULL THEN has_function_privilege('authenticated',p.oid,'EXECUTE') END,
      'execute_service_role', CASE WHEN p.oid IS NOT NULL THEN has_function_privilege('service_role',p.oid,'EXECUTE') END)
  FROM expected_functions e LEFT JOIN pg_proc p ON p.oid = to_regprocedure(e.signature)
  UNION ALL
  SELECT 'preferencia', 'profiles.' || e.name,
    jsonb_build_object('existe', a.attname IS NOT NULL, 'tipo', format_type(a.atttypid,a.atttypmod),
      'default', pg_get_expr(d.adbin,d.adrelid))
  FROM expected_preferences e LEFT JOIN pg_attribute a
    ON a.attrelid = to_regclass('public.profiles') AND a.attname = e.name AND NOT a.attisdropped
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  UNION ALL
  SELECT 'restricao', conname, jsonb_build_object('tabela',conrelid::regclass::text,
    'definicao',pg_get_constraintdef(oid),'validada',convalidated)
  FROM pg_constraint WHERE contype = 'c' AND conrelid IN
    (to_regclass('public.profiles'),to_regclass('public.marketplace_orders'),to_regclass('public.marketplace_order_items'))
  UNION ALL
  SELECT 'gatilho', t.tgname, jsonb_build_object('tabela',t.tgrelid::regclass::text,
    'habilitado',t.tgenabled,'definicao',pg_get_triggerdef(t.oid),
    'funcao',t.tgfoid::regprocedure::text,'security_definer',p.prosecdef,
    'dono_funcao',pg_get_userbyid(p.proowner))
  FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE NOT t.tgisinternal AND t.tgrelid IN (to_regclass('auth.users'),to_regclass('public.profiles'))
  UNION ALL
  SELECT 'politica', tablename || '.' || policyname,
    jsonb_build_object('comando',cmd,'roles',roles,'permissiva',permissive,'using',qual,'check',with_check)
  FROM pg_policies WHERE schemaname = 'public' AND tablename IN
    ('profiles','profile_contacts','user_roles','marketplace_orders','marketplace_order_items','purchases')
)
SELECT tipo, objeto, detalhes FROM report ORDER BY tipo, objeto;
