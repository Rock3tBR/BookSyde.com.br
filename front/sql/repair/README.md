# SQL de reparo — cadastro, preferências e compras

O reparo integrado de CRUD, papéis de publicação, leitura e exclusão está em [SQL_REPARAR_CRUD.sql](../../SQL_REPARAR_CRUD.sql). Veja a ordem de aplicação e os testes em [CORRECAO_CRUD.md](../../CORRECAO_CRUD.md).

Execute os arquivos inteiros no SQL Editor do banco conectado ao aplicativo, usando o papel `postgres`, nesta ordem:

1. [00_diagnostico.sql](00_diagnostico.sql): consulta tabelas, campos de preferências, permissões, políticas, restrições e gatilhos. Não altera dados nem retorna dados pessoais.
2. [01_cadastro_preferencias.sql](01_cadastro_preferencias.sql): recupera perfis ausentes, restaura o gatilho original de cadastro com permissões adequadas, adiciona campos de preferências e aceita os oito temas e o estilo `realistic` usados pelo app. Mantém `showcase` para compatibilidade com valores antigos. Inclui a tabela privada de telefone.
3. [02_compras.sql](02_compras.sql): instala `create_catalog_order_server` e `create_marketplace_order_server` **somente se estiverem ausentes**, restringe sua execução ao servidor e repara leitura de pedidos pelos participantes. Calcula preços a partir do banco e cria pedidos pendentes, seus itens e a mensagem de compra.

Cada correção usa sua própria transação. Se ocorrer erro, não continue executando trechos isolados: envie a mensagem completa e o resultado do diagnóstico. O script 01 recusa substituir um gatilho/função de cadastro com implementação diferente da original conhecida. O script 02 recusa habilitar compras sem as tabelas e funções de entrega necessárias. Ele preserva implementações de compra já instaladas; defeitos nelas precisam ser analisados com sua definição e o erro real.

As correções não apagam livros, usuários ou pedidos, não alteram preços, não promovem usuários a administradores e não confirmam pagamentos. Defaults se aplicam a novas gravações; personalizações existentes são preservadas. As restrições ampliadas usam `NOT VALID` para preservar valores históricos desconhecidos, mas validam novas gravações. Políticas adicionais/customizadas não são removidas: o diagnóstico mostra políticas restritivas ou permissivas que ainda possam exigir revisão.

## Evidências encontradas

- O commit `6c63f4de` removeu 53 migrações do repositório. Isso **não prova** que elas estejam ausentes no banco publicado.
- As restrições antigas de `profiles.theme` aceitam menos temas que `src/lib/theme.ts`.
- As restrições antigas dos campos `*_display_style` não aceitam `realistic`, oferecido por `src/lib/catalogDisplay.ts`.
- `src/routes/api/marketplace/order.ts` chama duas RPCs server-only que não têm definição nas migrações atuais nem no snapshot recuperado. Suas versões instaladas no banco, se existirem, são preservadas.
- A compra direta atual considera `distribution_channel = 'catalog'` e preço a partir de 100 centavos. O script segue esse contrato e exige uma obra pública cujo criador seja administrador, conforme o checkout da plataforma. Não atribui obras sem criador a um admin arbitrário.

## Validação e limites

Testado em PostgreSQL 17 temporário com uma fixture derivada do esquema histórico: reproduz falha de permissão no cadastro e rejeição de tema/estilo; verifica cadastro, perfil recuperado, preservação das preferências, telefone privado, isolamento de atualizações, idempotência, preços dos pedidos, vendedores distintos, disponibilidade por ambiente Stripe e permissões de execução.

Os testes usam Auth simplificado e assinaturas de funções de entrega que falham caso chamadas. **Não validam Stripe, entrega dos livros, o esquema completo nem o banco publicado.** Os SQLs atendem aos problemas identificáveis no código; não são uma reconstrução integral do banco nem uma garantia de corrigir todos os erros relatados.

Fora do alcance do SQL:

- Cadastro: SMTP, limite de emails, confirmação de email, URLs de redirecionamento e hooks externos do Supabase Auth.
- Pagamento: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_LIVE_API_KEY`/`STRIPE_SANDBOX_API_KEY`, `LOVABLE_API_KEY`, conexão Stripe, habilitação de recebimentos e segredos/eventos de webhook. Não coloque esses segredos no SQL nem no frontend.
- Pedidos pagos sem entrega: precisam de conferência do pagamento e do webhook; este reparo não muda seu status ou seus direitos de acesso.
- Avatar: bucket e políticas de Supabase Storage precisam ser diagnosticados separadamente se esse for o erro de personalização.
- `readingMode` é salvo apenas no `localStorage` em `src/pages/conta.tsx`; sincronizá-lo entre dispositivos exige mudança no aplicativo.

O Supabase documenta que [falhas em gatilhos/permissões podem bloquear o cadastro](https://supabase.com/docs/guides/troubleshooting/database-error-saving-new-user-RU_EwB) e que [atualizações com RLS também precisam de acesso de leitura](https://supabase.com/docs/guides/database/postgres/row-level-security). Os scripts tratam essas condições sem desativar RLS.

Para reproduzir os testes, use exclusivamente um banco PostgreSQL vazio e descartável:

```sh
psql -v ON_ERROR_STOP=1 -f tests/account-repair.sql
```


## Correção de tipos de conta/publicações (set/2026)

Para permitir que administradores alterem papéis sem `service_role` no navegador e garantir que apenas editores autorizados criem obras, execute `07_08_APLICAR_CONTAS_E_PUBLICACOES.sql` no SQL Editor do mesmo projeto do login. Ele inclui `07_alterar_tipo_conta.sql` e `08_permissoes_publicacao.sql`. **Não execute os três arquivos em sequência sem necessidade.** O script é idempotente. `09_diagnostico_publicacoes.sql` apenas diagnostica a existência de objetos e não retorna dados pessoais. Consulte `CORRECOES_CONTAS_PUBLICACOES.md` na raiz do projeto para detalhes e limites.
