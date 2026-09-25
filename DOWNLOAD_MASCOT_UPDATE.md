# BookSyde — Download com mascotes

Atualização visual do indicador de download offline usando as referências oficiais do BookSyde.

## Estados
- Inicializando: corvo lendo.
- Baixando: corvo acompanhando os livros.
- Processando: corvo carregando livros.
- Quase lá: corvo correndo com o livro.
- Concluído: corvo comemorando.
- Erro: Monstro de Livro perseguindo o corvo.

## Arquivos
- `front/src/components/OfflineDownloadStatus.tsx`
- `front/public/brand/download/*.webp`
- `front/public/brand/booksyde-crow-reference.jpg`
- `front/public/brand/booksyde-book-monster-reference.jpg`

O indicador continua consumindo o progresso real de `offlineVolumes.ts`; nenhuma regra de download foi substituída.
As animações respeitam `prefers-reduced-motion`.
