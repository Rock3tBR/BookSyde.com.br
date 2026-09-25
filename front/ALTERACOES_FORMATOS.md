# Hotfix de formatos de arquivo

## Motivo do hotfix

A primeira implementação de CBR adicionava `node-unrar-js` ao `package.json`. Como o projeto carrega `BackgroundUploadStatus` no layout raiz, esse caminho também carrega `volumeUpload` e `mangaFile` em todas as páginas. Em ambientes Lovable/Vite, a resolução dessa nova dependência podia quebrar o grafo de módulos e fazer o ErrorBoundary raiz aparecer em qualquer rota.

## Correção

- Removida a dependência `node-unrar-js` do projeto.
- `package.json` e `package-lock.json` voltaram ao estado original de dependências.
- O suporte a CBR agora é carregado sob demanda, somente quando um arquivo RAR/CBR é processado.
- O carregamento usa `@bitplane/rars` via módulo ESM remoto e `@vite-ignore`, portanto a aplicação não depende dessa biblioteca para iniciar.
- PDF, CBZ, ZIP, EPUB, MOBI, AZW/AZW3 e PRC continuam aceitos.
- EPUB de livro continua usando o fluxo EPUB original; outros formatos usam o fluxo de páginas.

## SQL

Nenhuma alteração de tabela é necessária para esse hotfix.
