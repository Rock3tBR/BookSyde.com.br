-- Corrige capas públicas antigas/novas independentemente do padrão de pasta usado no upload.
-- A leitura só é liberada quando o caminho está efetivamente referenciado por uma obra/volume público.
DROP POLICY IF EXISTS booksyde_cover_public_read ON storage.objects;
CREATE POLICY booksyde_cover_public_read
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'manga-covers'
  AND (
    EXISTS (
      SELECT 1
      FROM public.mangas m
      WHERE m.visibility = 'public'
        AND m.distribution_channel IN ('catalog', 'marketplace')
        AND m.cover_url = ('storage:' || name)
    )
    OR EXISTS (
      SELECT 1
      FROM public.volumes v
      JOIN public.mangas m ON m.id = v.manga_id
      WHERE v.published = true
        AND m.visibility = 'public'
        AND m.distribution_channel IN ('catalog', 'marketplace')
        AND v.cover_url = ('storage:' || name)
    )
    OR EXISTS (
      SELECT 1
      FROM public.volumes v
      JOIN public.mangas m ON m.id = v.manga_id
      WHERE v.published = true
        AND m.visibility = 'public'
        AND m.distribution_channel IN ('catalog', 'marketplace')
        AND name = (m.id::text || '/' || v.id::text || '-preview-page-10.png')
    )
  )
);
