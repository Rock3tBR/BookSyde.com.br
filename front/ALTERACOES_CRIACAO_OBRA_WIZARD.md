# Mangaka — criação de obra em etapas

## Alteração aplicada

A página **Estúdio → Criar obra** passou a exibir uma única etapa por vez, no lugar das quatro seções empilhadas. O menu lateral existente permanece.

1. **Informações:** formato, nome, autor, categoria e descrição curta.
2. **Arquivo e capa:** estrutura/coleção, escolha do EPUB/PDF quando necessário, upload e capa (inclusive extração de capa EPUB).
3. **Sinopse e acesso:** sinopse, destino Catálogo ou Marketplace e preço conforme as permissões existentes.
4. **Revisão:** resumo compacto da obra, direitos de publicação, termo de responsabilidade e botão de criação.

Há indicadores de progresso, botões **Voltar** e **Próximo**, validação por etapa e mensagens de erro no próprio formulário. As informações preenchidas e os arquivos selecionados são mantidos ao navegar entre as etapas. O botão **Criar obra** só aparece na revisão; após o cadastro, o fluxo volta à primeira etapa.

## Layout e limites

Foi removida a prévia lateral em tamanho grande. A capa aparece compacta somente durante a revisão, e o formulário passou a ter largura máxima menor. A criação não tem mais um formulário contínuo de quatro etapas que obrigue o usuário a rolar por todas elas. Em celulares ou telas de altura muito pequena, a rolagem normal continua habilitada para não cortar campos nem controles de acessibilidade.

Não foram alteradas as rotas, tabelas SQL, permissões, pagamentos, upload de volumes nem as regras de publicação existentes. A validação final da criação foi preservada, além das novas verificações ao avançar de etapa.

## Validação

Foi executada análise sintática TS/TSX do projeto e verificação estrutural das quatro etapas. Compilação completa e upload real dependem das dependências e da infraestrutura conectada ao projeto.
