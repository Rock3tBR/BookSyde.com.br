-- As capas das obras não contêm o conteúdo protegido do livro e precisam
-- carregar para visitantes, catálogo, detalhes, biblioteca e modelos 3D.
UPDATE storage.buckets
SET public = true
WHERE id = 'manga-covers';

-- Upload/alteração continua protegida pelas policies de INSERT/UPDATE existentes.
