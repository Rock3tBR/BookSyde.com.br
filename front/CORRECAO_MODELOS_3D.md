# Correção dos modelos 3D fechados

- O modelo deitado e o modelo em pé compartilham uma única geometria física (`ClosedBook3D.tsx`). As faces da capa, contracapa, lombada e páginas usam o mesmo sistema de coordenadas e espessura.
- Foi removido o marcador preto que se projetava para fora do livro e a antiga lateral de páginas desalinhada.
- No modo Realista há **somente um livro e uma imagem de capa por item**: em desktop com mouse ele gira suavemente da posição deitada para a posição em pé no hover. Mobile e tablet mostram apenas o livro deitado.
- A capa externa é carregada sem exigir cabeçalhos CORS. A amostragem de cor para a lombada é opcional; se não for permitida pelo navegador, a capa continua visível e é usado um tom neutro.
- A escala e a espessura do miolo foram ajustadas para os cards compactos, e as regras CSS conflitantes com `!important` no mobile foram removidas.
- A API pública dos componentes `Book3DModel` e `Book3DStandingModel` foi preservada. Nenhuma migration SQL é necessária.

Validação disponível neste ambiente: transpilação/sintaxe TSX dos quatro componentes alterados. A suíte de navegador e o build completo precisam ser executados após `npm ci`, pois a instalação das dependências não foi concluída neste ambiente.
