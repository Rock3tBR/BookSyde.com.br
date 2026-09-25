BEGIN;

-- Google Drive é a fonte do arquivo. O Supabase guarda somente metadados.
-- Remove a RPC experimental que aceitava páginas individuais para impedir
-- duplicação acidental de conteúdo do Drive na tabela public.pages.
DROP FUNCTION IF EXISTS public.booksyde_import_drive_volume_with_pages(
  uuid,text,text,integer,text,integer,bigint,jsonb
);

COMMIT;
