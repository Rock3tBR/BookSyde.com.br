# BookSyde — tipos de conta, criação de obras e envio de volumes

Base: versão com 8 temas e listagem de usuários V2. Os temas, a listagem e o login foram preservados.

## Por que o tipo de conta não mudava?

A tela listava diretamente pelo Supabase RPC, mas enviava modificações de papéis a `POST /api/admin-users`. Esta rota exigia `SUPABASE_SERVICE_ROLE_KEY` no servidor; quando a hospedagem não configurava essa variável, **a leitura funcionava e a alteração falhava**. Esta é uma falha confirmada no fluxo do código, não uma verificação das variáveis do ambiente publicado.

A opção **Administração > Usuários > Tipo de conta** agora chama `booksyde_admin_set_account_type` pelo cliente autenticado, como a listagem. A função SQL confere administrador real em `user_roles`, valida o alvo, recusa autoalteração, modifica os papéis de forma atômica e preserva assinaturas e dados de vendedor. `Editora` recebe `creator` por dependência. Não exponha `service_role` no navegador.

A criação de uma conta nova, o bloqueio da conta e a troca manual de planos continuam usando a rota privada do servidor; configure `SUPABASE_SERVICE_ROLE_KEY` só no servidor se quiser esses recursos.

## Instalação

1. Faça backup do projeto e do banco antes de aplicar políticas de segurança.
2. No SQL Editor do **mesmo projeto do login**, execute `sql/repair/07_08_APLICAR_CONTAS_E_PUBLICACOES.sql` inteiro. Requer o esquema principal instalado. Há cópia equivalente em `supabase/migrations/20260922010000_admin_types_publication_guards.sql` para quem gerencia migrações. Não aplique ambos como migrações distintas; o conteúdo é idempotente, mas um só caminho basta.
3. Publique o código atualizado e mantenha suas variáveis `.env` locais/privadas; elas não foram incluídas no ZIP por segurança.
4. Reentre na aplicação, escolha **outro usuário** e teste Cliente → Criador → Editora → Administrador. Alterar a própria conta continua bloqueado de propósito.
5. Crie uma obra de teste em Estúdio e adicione um arquivo por vez. Se surgir falha, execute `sql/repair/09_diagnostico_publicacoes.sql` (somente leitura) e consulte o status detalhado do envio. Não envie chaves ou tokens.

## Criação de livros, mangás, HQs e gibis

- Livros aceitam EPUB ou PDF. Mangás/HQs/gibis aceitam formatos em imagens (PDF, CBR, CBZ, ZIP, EPUB e arquivos Kindle com imagens detectáveis). **MOBI/AZW/PRC de texto não são convertidos em livros pelo mecanismo de imagens.**
- Formato e numeração são validados antes de enfileirar; 0 é permitido e lotes não podem passar do limite inteiro do Postgres.
- Só faz upload da capa principal depois de validar destino, preço e disponibilidade da venda; falhas de preço não deixam capa órfã.
- O texto de sucesso informa quando ainda é necessário configurar o anúncio no Marketplace, em vez de afirmar que um anúncio já foi feito.
- A migração aplica políticas restritivas para apenas contas com papéis Criador/Editora/Admin criarem ou editarem publicações. A função de gerenciamento de volumes respeita a mudança de papel.
- Capas legadas armazenadas por ID do criador podem ser visualizadas publicamente somente quando associadas explicitamente à capa de uma obra pública de Catálogo.

## Adição de volumes

- Número do próximo volume sugerido automaticamente conforme o conteúdo da obra. A unicidade do banco é por `(manga_id, number)`; o número não pode ser reutilizado entre volume e capítulo da mesma obra.
- Verificação de conflitos agora considera também capítulos e outros lotes da fila, com erro mais claro.
- Livro individual permite só um volume/arquivo nº 1. Coleções comportam vários EPUBs/PDFs.
- Capas de volumes validam tipo e tamanho; EPUB sem capa interna pode usar a capa já vinculada à obra.
- Erros de atualização do volume não são ignorados; publicação ocorre somente após upload de todas as páginas/metadados. O rollback tenta limpar os objetos de um volume incompleto. Volumes completos anteriores do mesmo lote são preservados e a mensagem de erro informa isso.

## Verificações realizadas e limitações

- Testes locais das validações de arquivo, numeração e capa passaram (6 grupos, com vários casos por grupo): `npm run test:publication`.
- Os arquivos TS/TSX modificados passaram por verificação de sintaxe com TypeScript.
- **Não foi possível executar `npm ci`, o build Vite, o Playwright completo, as migrações em um banco real nem uploads reais** neste ambiente: as dependências não estavam disponíveis para instalar. O banco de produção, credenciais, Storage, rede, CBR/RAR remoto e Stripe não foram testados. O parser CBR ainda depende de bibliotecas WASM remotas, que podem ser bloqueadas pelo navegador/rede.
- Após publicar, teste com obras e usuários descartáveis antes de usar em produção. Se um erro aparecer na tela de upload, o estágio exibido aponta a operação envolvida.
