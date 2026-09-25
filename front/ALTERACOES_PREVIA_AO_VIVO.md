# Estúdio: prévia ao vivo durante a criação

- A tela **Estúdio > Criar obra** utiliza duas colunas a partir de 1280px: formulário/etapas à esquerda e simulação à direita.
- A largura do painel de criação não fica mais limitada a `max-w-4xl`, aproveitando o espaço disponível sem mexer no menu lateral.
- Novo componente `src/components/LiveWorkPreview.tsx`, ligado diretamente ao estado que já alimenta a criação: título, autor, categoria, descrição, sinopse, formato, capa, destino, coleção e preço.
- Ao escolher a capa ou quando uma capa é extraída do EPUB, a prévia mostra a imagem via URL temporária já gerenciada pelo formulário, sem uploads adicionais.
- Antes de selecionar capa, exibe um placeholder com o título digitado. Informações não preenchidas usam textos demonstrativos; a prévia não grava nada.
- Para catálogo gratuito, a simulação exibe **Gratuito** independentemente do preço inicial em memória, respeitando a regra de publicação de criadores/editoras.
- No celular e em tablets, **Visualizar prévia ao vivo** abre e fecha o painel nativamente; o formulário mantém largura total e a página só rola se o conteúdo exceder a tela.
- Não foram modificados fluxo de envio, validações dos quatro passos, gateway, rotas ou banco de dados.

## Conferência manual em navegador

1. Abra Estúdio > Criar obra, digite nome/autor/categoria/descrição e observe o painel da direita atualizar sem pressionar Próximo.
2. Avance e carregue uma capa; confira que a miniatura muda. Para EPUB com capa, aguarde a extração.
3. Preencha sinopse e alterne Catálogo/Marketplace e preço; confira resumo e indicador de preço.
4. Volte etapas e confirme que os dados continuam preenchidos e a prévia continua sincronizada.
5. Em 375px, 390px, 768px e 1024px, use o expansor de prévia; confira que não há rolagem horizontal.
6. Em 1280px e 1440px, confira duas colunas e que os botões de navegação continuam abaixo do formulário.
