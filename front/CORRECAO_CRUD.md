# Reparo do CRUD e permissões

As alterações corrigem falhas reproduzidas no esquema do repositório. O reparo foi validado em PostgreSQL 17 descartável, com papéis `anon`, `authenticated`, `service_role`, criador/editora, administrador e leitor. **Ainda é necessário aplicar o SQL no Supabase e publicar este código.** A sessão local tem somente URL e chave pública, sem conexão administrativa para executar migrações no banco remoto.

## Aplicação no projeto existente

1. Execute **SQL_REPARAR_CRUD.sql inteiro**, como `postgres`, no SQL Editor do mesmo projeto Supabase usado pelo login. O script exige o esquema principal e a estante física existentes; não execute o bootstrap `booksyde_full_schema.sql` sobre um banco com dados.
2. Publique o frontend e as rotas do servidor desta revisão. Leitura/exclusão usam as RPCs novas, portanto aplique o SQL antes de publicar o código.
3. Para criar/bloquear contas, gerenciar planos e enviar recuperação de senha pela gestão atual, configure `SUPABASE_SERVICE_ROLE_KEY` nos **secrets privados do servidor**. Use a chave do mesmo projeto de `SUPABASE_URL`. A chave não deve receber prefixo `VITE_`. Veja `.env.example`.
4. Valide com uma conta administrativa e uma conta editora: criar obra privada, enviar arquivo, editar, ler e excluir; altere também o tipo de uma conta de teste. Criação/bloqueio de contas precisa da configuração do passo anterior.

O SQL é transacional e pode ser reaplicado. Não promove contas automaticamente, não apaga dados durante a instalação, não desativa RLS e não permite ao navegador confirmar pagamentos. Migrações incrementais equivalentes estão em `supabase/migrations`.

## Correções

- Corrigida a delimitação SQL de `search_readers`, que abortava a migração antes dos grants da estante física.
- Restaurados grants explícitos de tabelas, colunas públicas e RPCs utilizados pelo aplicativo. O reparo recusa conceder escrita às tabelas verificadas se elas não tiverem RLS e políticas instaladas.
- Reinstalada a RPC de alteração de tipo de conta e as regras de publicação para criador/editora/admin.
- Páginas, download offline e imagens de continuação de leitura deixam de consultar `pages.storage_path` diretamente, pois o esquema proíbe esse SELECT. A RPC verifica acesso ao conteúdo e publicação antes de retornar os caminhos; o Storage verifica novamente antes de assinar o arquivo. Campos privados de obras continuam separados.
- Rotas de leitura e exclusão passam a usar o JWT do usuário e a chave pública, eliminando a dependência da chave administrativa nesses dois fluxos. Prévia continua limitada à página 10; EPUB completo exige acesso à obra.
- Exclusão de obra/volume usa uma transação com autorização e auditoria. Anúncios da obra excluída ficam inativos. Recibos privados em `publication_cleanup` permitem remover arquivos depois da exclusão dos registros; erros no Storage preservam os recibos para uma tentativa posterior. Capas ainda usadas por outra publicação são preservadas. A limpeza pendente é tentada nas próximas exclusões desse usuário.
- Edição de volumes/visibilidade exige uma linha realmente alterada. Falhas na consulta de papéis, obras e páginas passam a aparecer na interface, em vez de se confundirem com falta de permissão ou listas vazias.

## Validação

- Instalação completa em banco vazio, simulação de grants ausentes, reparo e reaplicação: **61 verificações SQL passaram**. Incluem CRUD, preferências, telefone, estante, amigos, biblioteca, anúncios, suporte, tipo de conta, convites, isolamento e limpeza após exclusão.
- **7 testes de API passaram**, incluindo rejeição de páginas não autorizadas, exclusão negada e falha de rede depois de uma exclusão confirmada.
- **6 testes de validação de publicações passaram**.
- **2 testes de navegador passaram**, verificando o contrato RPC e a propagação do erro 42501.
- `npm run build` passou. O inventário estático não encontrou tabelas/RPCs literais ausentes das migrações.
- `tsc --noEmit` ainda encontra erros anteriores fora das alterações, incluindo componentes de demonstração, estante, tipos opcionais e checkout Stripe.
- A suíte antiga `publications.spec.ts` + `offline.spec.ts` teve 3 testes passando e 4 falhando: fixture importa `OfflineGate` que não existe, teste EPUB espera array mas `readEpub` retorna objeto, e seletor antigo do filtro da home. Não representa validação completa da interface.

Para repetir em um banco **vazio e descartável** (o runner recusa tabelas existentes):

```sh
DATABASE_TEST_URL='postgresql://usuario@localhost/banco_descartavel' npm run test:database
npm run test:database-api
npm run test:publication
npx playwright test tests/database-client.spec.ts
npm run build
```

Use `PSQL_BIN` para informar o executável `psql` quando não estiver no PATH. A fixture simula os papéis e objetos básicos de Auth/Storage; não substitui testes do serviço Supabase real. Não foram executadas mutações no banco publicado nem validados SMTP, criação/bloqueio de usuários via Auth Admin, pagamentos Stripe ou webhooks.

Referências: [privilégios de colunas](https://supabase.com/docs/guides/database/column-level-security), [RLS e políticas de atualização](https://supabase.com/docs/guides/database/postgres/row-level-security), [autorização do Storage](https://supabase.com/docs/guides/storage/security/access-control).
