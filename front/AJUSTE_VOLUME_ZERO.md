# Volume 0 — cadastro, edição e ordenação

O cadastro e a edição aceitam qualquer número inteiro >= 0. A fila exibe 0 corretamente, inclusive ao enviar vários arquivos (0, 1, 2...). O campo vazio continua inválido no envio. O livro avulso conserva o número único 1; as coleções de livros podem usar 0.

## SQL Editor

- Se você já aplicou a correção de RLS anterior, execute somente `MangakaLib_SQL_PERMITIR_VOLUME_ZERO.sql`.
- Se ainda não aplicou a correção anterior, execute `MangakaLib_SQL_RLS_E_VOLUME_ZERO.sql` para aplicar as duas.
- As migrations do projeto também incluem `supabase/migrations/20260917230000_volume_number_zero.sql` (não execute em duplicidade se seu deploy já roda migrations).

A migração só substitui CHECKs simples que proíbam zero, preserva as outras regras, adiciona `number >= 0` e interrompe com erro explícito diante de uma constraint composta/desconhecida. O schema e a execução no banco online não foram validados aqui. Faça backup antes de executar.
