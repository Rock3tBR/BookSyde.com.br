# Estilo Realista — correção V2

## Problemas corrigidos

- O modo Realista não ficava restrito somente ao catálogo/Home.
- O preview mobile do Lovable podia interpretar mouse/trackpad como desktop e trocar o livro para o modelo em pé.
- Marketplace não respeitava a preferência de exibição Realista.
- A página da obra continuava usando capa plana mesmo com Realista ativo.
- A seleção do estilo só refletia visualmente após persistência; agora a experiência muda imediatamente.

## Implementado

- `RealisticExperienceBridge`: propaga o modo Realista para o shell inteiro do site.
- Atributo global `data-realistic-experience="true"` no `html/body`.
- Fundo com iluminação ambiente em todas as rotas.
- Header, footer, dock, menus, dialogs, cards, inputs e superfícies com acabamento realista consistente.
- Menos arredondamento excessivo e sombras mais físicas.
- `RealisticBookModel` reutilizável em Home, Biblioteca, Marketplace e página da obra.
- Desktop >= 1024px + mouse preciso: livro deitado e troca para em pé no hover.
- Mobile/tablet < 1024px: livro sempre deitado, inclusive dentro do preview responsivo do Lovable.
- Marketplace usa modelo 3D quando a categoria daquela obra está configurada como Realista.
- Página de detalhes da obra usa modelo 3D no modo Realista.
- Catálogo/Biblioteca mantém sombra de contato, brilho de capa e superfície física.
- Seleção do estilo na Personalização aplica a aparência imediatamente; o botão Salvar continua persistindo no perfil.
- `prefers-reduced-motion` continua respeitado.

## Validação

Os arquivos TS/TSX modificados foram validados sintaticamente com TypeScript. O build completo não pôde ser executado neste ambiente porque a instalação local das dependências do ZIP está incompleta.
