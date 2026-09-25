# Correção da lista de usuários — BookSyde

## Diagnóstico no código recebido

- `src/routes/api.admin-users.ts` usava `auth.admin.listUsers()` e o cliente administrativo tanto na listagem quanto na autenticação da própria rota.
- O `.env` recebido **não tem `SUPABASE_SERVICE_ROLE_KEY`**; sem essa variável no servidor, o endpoint não consegue carregar os usuários. Não temos acesso às variáveis do ambiente publicado, portanto não dá para afirmar que a chave também está ausente na hospedagem.
- No painel, o contador mostrava `0 usuário(s)` enquanto os quatro retângulos de carregamento ainda estavam visíveis; o erro efetivo do servidor ficava genérico e não explicava a configuração ausente.
- O formulário enviava os papéis escolhidos na criação da conta, mas o endpoint os ignorava.

## Como ativar a listagem corrigida

1. No Supabase, selecione **o mesmo projeto configurado no BookSyde**.
2. Abra **SQL Editor → New query**, cole todo o arquivo `sql/repair/05_listagem_usuarios_admin.sql` e execute como `postgres`.
3. Publique este código atualizado na hospedagem com suporte às rotas de servidor TanStack Start (não basta publicar um diretório de arquivos estáticos).
4. Entre novamente e abra **Administração → Usuários**.

A listagem agora chama `public.booksyde_admin_list_users()`, que lê usuários do `auth.users`, une perfis, papéis e assinaturas, mas somente devolve dados após confirmar o papel `admin` **com base no JWT da requisição**. A função foi criada com `SECURITY DEFINER`, com `search_path` vazio, autorização explícita e execução concedida somente a `authenticated`. Não foi necessário desativar o RLS, liberar `auth.users` ao público ou expor uma chave privada ao frontend.

O script é aditivo: não apaga usuários, não recria tabelas e pode ser executado novamente.

## Para criar, bloquear ou alterar permissões de outros usuários

Essas ações continuam a exigir `SUPABASE_SERVICE_ROLE_KEY` **nas variáveis privadas do servidor**, além de `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` do mesmo projeto. Configure a chave no painel de hospedagem, nunca em variáveis `VITE_*`, em código-fonte versionado ou num `.env` enviado a terceiros. O endpoint agora dá erro de configuração claro caso a chave não esteja presente. Os papéis escolhidos no formulário Criar conta são gravados; selecionar Editora atribui também Criador.

O ZIP mantém o `.env` original enviado pelo usuário; nenhuma chave de serviço foi incluída ou fabricada. Se a criação ou edição continuar falhando, confira as variáveis privadas, a instalação do schema original e as mensagens exibidas no painel.

## Testes recomendados após publicação

- Admin logado: a lista retorna usuários do projeto, inclusive o próprio administrador.
- Usuário normal logado: `/api/admin-users` retorna HTTP 403; RPC não entrega a lista.
- Visitante não logado: `/api/admin-users` retorna HTTP 401; RPC não concede acesso `anon`.
- Sem a função instalada: erro explicando qual SQL executar, em vez de mostrar zero usuários.
- Sem service role: a listagem continua disponível para o admin; criar/editar mostra aviso de configuração.
