-- Diagnóstico SOMENTE LEITURA: execute se criação/volumes falharem depois da publicação.
-- Retorna apenas existência de objetos, sem e-mails, senhas, obras ou dados pessoais.
SELECT
  to_regclass('public.mangas') IS NOT NULL AS tabela_obras,
  to_regclass('public.volumes') IS NOT NULL AS tabela_volumes,
  to_regclass('public.pages') IS NOT NULL AS tabela_paginas,
  to_regclass('public.user_roles') IS NOT NULL AS tabela_papeis,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='booksyde_admin_set_account_type') AS rpc_tipo_conta,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='can_manage_publication') AS permissao_publicacao,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='is_creator') AS funcao_criador,
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mangas'
    AND policyname='booksyde_publisher_only_insert') AS politica_criacao,
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname='volumes_manga_number_unique'
    AND conrelid=to_regclass('public.volumes')) AS volume_numero_unico,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id='manga-covers') AS bucket_capas,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id='manga-pages') AS bucket_paginas,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id='volume-sources') AS bucket_originais;
