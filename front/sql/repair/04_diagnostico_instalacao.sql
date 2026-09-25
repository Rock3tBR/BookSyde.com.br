-- BookSyde: análise da instalação nova. Somente leitura.
-- Execute inteiro no SQL Editor do projeto novo, como postgres.
-- Não retorna e-mails, nomes, tokens ou conteúdo de livros.

-- 1. Cadastro: contas, perfis e papéis criados pelo gatilho.
SELECT
  (SELECT count(*) FROM auth.users) AS contas,
  (SELECT count(*) FROM public.profiles) AS perfis,
  (SELECT count(*) FROM auth.users u WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
  )) AS contas_sem_perfil,
  (SELECT count(*) FROM public.user_roles WHERE role::text = 'admin') AS administradores,
  (SELECT count(*) FROM public.user_roles WHERE role::text IN ('creator','editora')) AS criadores_editoras,
  (SELECT count(*) FROM public.mangas) AS total_obras;

-- 2. Permissões dos campos realmente consultados pelo aplicativo.
WITH expected(table_name, column_name) AS (VALUES
  ('mangas','invite_token'), ('mangas','licensed_purchase_url'),
  ('mangas','licensed_store_name'), ('mangas','title'),
  ('volumes','source_path'), ('volumes','source_name'),
  ('volumes','file_format'), ('pages','storage_path'), ('profiles','display_name')
)
SELECT e.table_name AS tabela, e.column_name AS campo,
  a.attname IS NOT NULL AS existe,
  CASE WHEN a.attname IS NOT NULL
    THEN has_column_privilege('anon', c.oid, a.attname, 'SELECT') END AS leitura_visitante,
  CASE WHEN a.attname IS NOT NULL
    THEN has_column_privilege('authenticated', c.oid, a.attname, 'SELECT') END AS leitura_autenticado,
  CASE WHEN c.oid IS NOT NULL
    THEN has_table_privilege('authenticated', c.oid, 'INSERT') END AS insert_autenticado
FROM expected e
LEFT JOIN pg_class c ON c.oid = to_regclass('public.' || e.table_name)
LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = e.column_name
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY tabela, campo;

-- 3. Gatilhos do cadastro e da publicação, incluindo funções e proprietário.
SELECT t.tgrelid::regclass AS tabela, t.tgname AS gatilho, t.tgenabled AS habilitado,
  pg_get_triggerdef(t.oid) AS definicao,
  p.oid::regprocedure AS funcao, p.prosecdef AS security_definer,
  pg_get_userbyid(p.proowner) AS dono_funcao, p.proconfig AS configuracao,
  pg_get_functiondef(p.oid) AS codigo_funcao
FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal AND t.tgrelid IN (
  to_regclass('auth.users'), to_regclass('public.profiles'), to_regclass('public.mangas')
)
ORDER BY tabela, gatilho;

-- 4. Políticas efetivas de cadastro/publicação e Storage.
SELECT schemaname, tablename, policyname, cmd, roles, permissive, qual, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN ('profiles','user_roles','mangas','volumes','pages'))
   OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY schemaname, tablename, policyname;

-- 5. Buckets esperados pelo envio de arquivos.
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('avatars','manga-covers','manga-pages','volume-sources','literary-place-photos','donations')
ORDER BY id;
