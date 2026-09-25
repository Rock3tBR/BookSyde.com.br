# Correção do progresso de leitura

## Problema

Ao reabrir livros EPUB, o leitor podia voltar para a primeira página mesmo existindo progresso salvo.
O iframe do EPUB iniciava na página 0 durante o cálculo da paginação e esse valor podia sobrescrever a posição restaurada.

Também havia uma condição semelhante em arquivos baseados em páginas (PDF, CBR, CBZ etc.): a posição local era salva imediatamente, mas a sincronização com o banco possuía atraso. Ao reabrir rápido, um registro remoto mais antigo podia ter prioridade sobre a posição local mais recente.

## Alterações

- `src/components/EpubReader.tsx`
  - impede que a página 0 inicial do iframe sobrescreva o progresso salvo;
  - restaura a posição e espera confirmação do iframe antes de permitir novas gravações;
  - preserva a posição após o recálculo da paginação/fontes;
  - compara `updated_at` remoto com o timestamp local e usa o progresso mais recente;
  - salva um timestamp local junto com cada mudança de página;
  - mantém restauração ao alternar entre leitura paginada e vertical.

- `src/routes/ler.$volumeId.tsx`
  - passou a carregar `updated_at` de `reading_progress`;
  - compara a versão local e remota antes de escolher a página inicial;
  - evita que um progresso remoto antigo substitua uma página local mais recente.

## Banco de dados

Nenhuma alteração de estrutura é necessária. A tabela `reading_progress` já possui `page_index` e `updated_at` no projeto atual.
