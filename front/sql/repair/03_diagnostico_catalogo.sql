-- BookSyde: diagnóstico somente de leitura para catálogo vazio.
-- Execute inteiro no SQL Editor do projeto conectado ao site, como postgres.
-- Retorna contagens e estrutura; não retorna títulos, usuários ou arquivos.
WITH expected_columns(name) AS (VALUES
  ('id'), ('slug'), ('title'), ('author'), ('cover_url'), ('genres'),
  ('price_cents'), ('currency'), ('catalog_sale_enabled'), ('work_type'),
  ('synopsis'), ('view_count'), ('created_at'), ('visibility'),
  ('distribution_channel')
), report AS (
  SELECT '1_registros' AS verificacao,
    jsonb_build_object(
      'total_obras', count(*),
      'publicas_no_catalogo', count(*) FILTER (
        WHERE to_jsonb(m)->>'visibility' = 'public'
          AND to_jsonb(m)->>'distribution_channel' = 'catalog'
      ),
      'demais_obras', count(*) FILTER (
        WHERE (to_jsonb(m)->>'visibility' = 'public'
          AND to_jsonb(m)->>'distribution_channel' = 'catalog') IS NOT TRUE
      )
    ) AS resultado
  FROM public.mangas m
  UNION ALL
  SELECT '2_campos_ausentes', coalesce(jsonb_agg(e.name ORDER BY e.name), '[]'::jsonb)
  FROM expected_columns e
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'mangas'
      AND c.column_name = e.name
  )
  UNION ALL
  SELECT '3_permissoes', jsonb_build_object(
    'rls_ativo', c.relrowsecurity,
    'anon_pode_ler_tabela', has_table_privilege('anon', c.oid, 'SELECT'),
    'authenticated_pode_ler_tabela', has_table_privilege('authenticated', c.oid, 'SELECT')
  )
  FROM pg_class c WHERE c.oid = 'public.mangas'::regclass
  UNION ALL
  SELECT '4_politicas', coalesce(jsonb_agg(jsonb_build_object(
    'tabela', tablename, 'nome', policyname, 'comando', cmd,
    'roles', roles, 'permissiva', permissive, 'condicao', qual
  ) ORDER BY tablename, policyname), '[]'::jsonb)
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('mangas', 'volumes', 'user_roles')
    AND cmd IN ('SELECT', 'ALL')
)
SELECT verificacao, resultado FROM report ORDER BY verificacao;
