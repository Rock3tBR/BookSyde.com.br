# Marketplace BookSyde — atualização visual

Arquivo principal alterado: `src/pages/marketplace.tsx`.

## O que mudou

- Hero editorial responsivo com a identidade dos oito temas existentes. Exibe capa real quando há publicação e uma ilustração neutra quando o catálogo está vazio.
- A seção de vendedores só aparece quando existem vendedores com publicações; evita a enorme caixa vazia da versão anterior.
- Catálogo reorganizado: filtros por tipo (livros, mangás, HQs, gibis e coleções), título, autor, categoria e preços.
- Ordenação por data, preço e título. Quando se consultam obras semelhantes, a ordem de similaridade original continua prioritária.
- Filtros avançados recolhíveis no celular e botão para remover filtros, inclusive parâmetros de vendedor e similares na URL.
- Cards de publicação com altura alinhada, seleção e desejos preservados, loading em skeleton, erro com opção de tentar novamente.
- Estado vazio diferenciado para catálogo realmente vazio versus busca sem resultados, sem incluir itens fictícios.
- Faixa informativa com o funcionamento do marketplace e ajustes de acessibilidade nos controles.

## Escopo

Não alteramos o banco, políticas RLS, Stripe ou as rotinas de compra e vendedor. Os oito temas seguem utilizando as variáveis semânticas do projeto. Não é preciso executar SQL para aplicar esta atualização visual.

## Rodar

`npm install && npm run build`

Observação: a verificação de sintaxe TSX passou, porém a compilação completa não pôde ser executada neste ambiente porque uma dependência (`zod`) não estava no cache e a instalação online não terminou. Execute o build acima no seu ambiente antes de publicar.
