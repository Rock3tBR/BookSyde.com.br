# Ajustes do estilo Realista

Implementação aplicada ao estilo **Realista** do catálogo e à Home quando esse estilo está ativo.

## Alterações

- Livros 3D com sombra de contato, iluminação física e reflexo de verniz na capa.
- Comportamento deitado por padrão e em pé no hover de desktop com mouse; touch permanece deitado.
- Superfície/prateleira visual sutil sob o catálogo.
- Home com iluminação ambiente e profundidade quando o modo Realista está ativo.
- Hero com vinheta cinematográfica, camadas de luz e parallax leve seguindo o ponteiro.
- Sidebar de leitura e card de leitura diária com material mais fosco, menos aparência de dashboard e cantos menores.
- Header refinado com blur de 24px, transparência mais equilibrada, bordas discretas e cantos reduzidos.
- Redução dos arredondamentos principais no modo Realista.
- Efeitos limitados aos elementos de maior impacto para evitar excesso de animação.
- Compatibilidade com `prefers-reduced-motion`.
- Layout responsivo preservado em desktop, tablet e mobile.

## Arquivos principais alterados

- `src/pages/index.tsx`
- `src/components/HomeSections.tsx`
- `src/components/CatalogDisplayCard.tsx`
- `src/components/Book3DModel.tsx`
- `src/components/Book3DStandingModel.tsx`
- `src/components/SiteHeader.tsx`
- `src/styles.css`

## Validação

Foi feita validação sintática dos TSX modificados com TypeScript. O build completo não pôde ser executado neste ambiente porque as dependências do projeto não estavam instaladas integralmente no ZIP recebido.
