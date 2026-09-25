# Tutorial guiado do MangakaLib

Foi adicionado um tutorial em formato de tour guiado, sem dependências externas.

## Funcionamento

- O restante da interface é escurecido durante cada etapa.
- Apenas a área explicada permanece visível e recebe um contorno de destaque.
- O usuário pode avançar, voltar ou fechar o tutorial.
- Ao trocar de assunto, o tutorial navega automaticamente para a página correspondente.
- Recursos que não existem para a conta atual (ex.: área de Criador para usuário comum) são explicados em um cartão central sem causar erro.
- O botão `?` no cabeçalho inicia o tutorial completo novamente a qualquer momento.
- Dentro dos leitores existe um botão `?` para iniciar o tutorial específico da leitura.

## Áreas cobertas

1. Home
   - navegação principal
   - novidades
   - continuar lendo
   - catálogo e filtros
2. Biblioteca
   - organização pessoal
   - abas de leitura
   - conteúdo offline
3. Marketplace
   - funcionamento geral
   - vendedores
   - busca/filtros/compra
4. Mapa Literário
   - lista e busca
   - pins e mapa
   - rotas / como chegar
   - adição de novos locais
5. Estúdio / Área do Criador
   - minhas obras
   - criação de obra
   - adição de volumes, capítulos e arquivos
6. Central do Vendedor
   - indicadores
   - recebimentos
   - vendas
   - catálogo e perfil público
7. Leitores
   - mangás/HQs/gibis em páginas
   - PDF/CBR/CBZ e formatos processados em páginas
   - livros EPUB
   - página/scroll
   - progresso automático

## Arquivos principais

- `src/components/SystemTutorial.tsx`
- `src/components/SiteHeader.tsx`
- `src/routes/__root.tsx`
- `src/routes/index.tsx`
- `src/routes/biblioteca.tsx`
- `src/routes/marketplace.tsx`
- `src/routes/mapa-literario.tsx`
- `src/routes/admin.tsx`
- `src/routes/marketplace_.vendedor.tsx`
- `src/routes/ler.$volumeId.tsx`
- `src/components/EpubReader.tsx`

Não é necessária migration ou alteração SQL para o tutorial.

## Ajustes de demonstração do tutorial

- O card explicativo prioriza uma posição completamente fora da área destacada: direita, esquerda, abaixo ou acima, de acordo com o espaço disponível.
- Em telas pequenas, quando não existe espaço físico suficiente, o card usa a maior faixa livre disponível e passa a ter rolagem interna.
- Usuários Free podem visualizar demonstrações do Estúdio e da Central do Vendedor durante o tutorial sem receber permissões reais de Criador/Vendedor.
- Se não houver volumes baixados, a etapa de leitura offline mostra uma prévia temporária com conteúdos fictícios marcados como exemplo do tutorial.
- As prévias existem apenas dentro do tour e não criam obras, vendas, downloads ou registros no banco.
