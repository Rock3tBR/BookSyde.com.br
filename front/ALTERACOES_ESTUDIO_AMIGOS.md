# Mangaka — Estúdio, Header e Amigos (16/09/2026)

## Alterações incluídas no projeto

- **Estúdio:** os três botões horizontais foram substituídos por menu lateral no desktop e menu recolhível no celular, com nomes, ícones e descrições. As abas originais continuam ligadas aos mesmos formulários e recursos; a mudança de aba não remonta o formulário. A prévia lateral da criação tem 280 px e ocupa menos espaço. O tutorial passa a ignorar alvos invisíveis.
- **Header:** Planos aparece para visitantes, clientes, criadores e vendedores. Não aparece para administradores nem editoras, inclusive nos menus de conta/mobile. Admin tem um único Dashboard, que leva a `/admin/dashboard` e permanece ativo nas páginas administrativas.
- **Amigos:** tela `/social` e dock inferior usam a mesma busca, que reconhece nomes parciais (inclusive com espaços) e códigos completos, com ou sem `#`, sem montar manualmente filtros `.or()` vulneráveis a pontuação. Estados de carregamento, falha e busca vazia são diferentes. Os perfis dos contatos são recuperados por função restrita em vez de exigir SELECT público indiscriminado na tabela de perfis.

## Etapa obrigatória: migração SQL no Supabase

**O ZIP não executa SQL automaticamente em um banco remoto.** Para habilitar a busca de forma segura, abra o projeto Supabase do Mangaka, entre no SQL Editor e execute **uma única vez** o conteúdo do arquivo:

`supabase/migrations/20260916150000_reader_discovery.sql`

Alternativamente, aplique a migração pelo fluxo de migrações Supabase já configurado no seu projeto. A migração cria duas funções `search_readers` e `get_reader_profiles`, disponíveis somente a contas autenticadas, que retornam apenas ID, nome público, avatar e código. Não substitua isso por uma política `SELECT USING (true)` em toda a tabela `profiles`.

Se a migração ainda não estiver aplicada, o cliente usa uma consulta de compatibilidade que respeita a RLS antiga, e avisa quando a busca não está configurada. Dependendo das políticas existentes, o fallback pode continuar retornando zero resultados.

## Como validar com duas contas diferentes (A e B)

1. Entre como A, em Amigos, gere um código se ainda não tiver um. Confirme que é exibido; copie o código.
2. Entre como B e procure o **nome completo ou parte do nome** da conta A em Amigos e também no painel inferior; A deve aparecer, nunca B.
3. Procure o código de A com e sem `#`, inclusive usando letras minúsculas. A deve aparecer. Procure código inexistente; deve retornar “nenhum leitor encontrado”.
4. Envie pedido de B para A. Entre como A e confirme pedido recebido; aceite-o. Retorne a B, atualize e confira a conversa e perfil. Se o RPC de solicitação falhar, capture o erro exibido e verifique o procedimento `send_friend_request` e a política `friendships` do banco.
5. Confira Admin e Editora: **sem Planos**. Confira visitante, cliente, criador e vendedor: **Planos visível**. Em Admin: **um Dashboard**, inclusive ao abrir subpáginas.
6. No Estúdio, navegue por Minhas obras, Criar obra e Conteúdo no desktop e no celular; confira rolagem lateral, acesso ao menu e que rascunhos de formulário não somem só por abrir/fechar o menu.

## Limites de validação neste pacote

Os testes incluídos (`node tests/social-search-regression.cjs`) verificam a lógica de normalização, os contratos de chamadas RPC, mensagens de falha, os links por perfil e a estrutura das navegações. Todos os arquivos TS/TSX também podem ser analisados sintaticamente. **Não foi possível testar sessões reais, RLS, pedidos de amizade, build de produção ou navegação no navegador com conexão ao Supabase:** isso depende de aplicar o SQL no projeto correto, instalar as dependências e executar com contas de teste.
