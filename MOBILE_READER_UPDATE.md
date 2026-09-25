# BookSyde — melhoria do leitor mobile

Base: última versão `booksyde-cloudflare-auth-performance-corrigido`.

## Ajustes desta versão
- Leitura mobile imersiva com controles que somem automaticamente após 4 segundos.
- Zonas de toque no modo paginado: esquerda volta, centro mostra/oculta controles, direita avança.
- Mantidos swipe horizontal, modo vertical, fullscreen, progresso, retomada de leitura e navegação por páginas.
- Mantido duplo toque para zoom no leitor de imagens.
- Mantido pré-carregamento das páginas seguintes (mais agressivo para Plus, econômico no Data Saver).
- EPUB recebeu as mesmas zonas de toque dentro do iframe sandboxado.
- Preservadas as correções anteriores de Cloudflare, Google Drive, EPUB e autenticação/performance.

## Validação local
O código foi revisado, porém o build no ambiente de empacotamento não pôde ser concluído porque a instalação das dependências excedeu o tempo disponível. Antes do deploy, execute `npm install` e `npm run build` normalmente no projeto.
