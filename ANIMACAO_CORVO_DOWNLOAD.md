# BookSyde — animação 2D do corvo no download

O indicador de download deixou de animar o card/imagem inteira com `translateY`.

Agora `CrowDownloadAnimation.tsx` usa uma sequência de poses oficiais do mascote extraídas da folha de referência do próprio projeto. O corvo alterna ações reais conforme o estado do download: leitura, troca/segura livro, organização da pilha, transporte, finalização e erro.

- `initializing`: leitura + observação/pensamento.
- `downloading`: lê, segura/troca o livro, reorganiza a pilha e volta à leitura.
- `processing`: carrega e organiza livros.
- `almost`: ação rápida de finalização.
- `complete`: comemora e retorna para pose de descanso.
- `error`: mantém a cena do monstro/livro.

A troca de poses usa transição curta em passos para lembrar animação 2D quadro a quadro, sem o antigo efeito de a imagem inteira ficar apenas subindo e descendo. `prefers-reduced-motion` continua respeitado.

Arquivos principais:
- `front/src/components/CrowDownloadAnimation.tsx`
- `front/src/components/OfflineDownloadStatus.tsx`
- `front/public/brand/download/frames/*.webp`
