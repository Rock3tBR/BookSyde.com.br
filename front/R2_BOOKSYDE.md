# Cloudflare R2 no BookSyde

Os arquivos pesados novos (`EPUB`, `PDF`, `CBR`, `CBZ` e páginas extraídas) são enviados ao bucket privado `booksyde-files` via URLs assinadas. Capas, avatares e imagens auxiliares continuam no Supabase Storage.

## Variáveis obrigatórias no servidor

```env
R2_ENDPOINT=https://SEU_ACCOUNT_ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=booksyde-files
```

Não use prefixo `VITE_` nessas variáveis. Elas são segredos de servidor.

## Estrutura no R2

- `sources/{mangaId}/{volumeId}/arquivo.epub|pdf|cbz|cbr`
- `pages/{mangaId}/{volumeId}/000001.webp` etc.

O bucket deve permanecer privado. O leitor valida o acesso pelo Supabase/RPC e só depois gera uma URL temporária do R2.

## Compatibilidade

Esta versão passa a ler arquivos novos pelo R2. Arquivos antigos que ainda existam apenas nos buckets `volume-sources`/`manga-pages` do Supabase devem ser migrados para o R2 antes de remover esses buckets.
