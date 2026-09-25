# BookSyde — Estágios 11 a 15

## Estágio 11 — Vendedores
- Corrigido o mapeamento `marketplace_sellers` para refletir o schema atual (o estágio anterior assumia `suspended_at`, coluna inexistente no schema consolidado).
- Criados `SellerService`, `SellerController` e DTO de status do vendedor.
- O backend passa a determinar readiness de Stripe sandbox/live pelos campos persistidos.

## Estágio 12 — Marketplace
- Mapeadas `marketplace_listings`, `marketplace_orders` e `marketplace_order_items`.
- Criados repositories, service e controller.
- Listagem pública, pedidos do comprador e visão de listagens/pedidos do vendedor disponíveis pela REST API.
- Ownership de pedido validado no backend.
- Fluxo legado de criação de pedido/RPC permanece preservado até sua substituição validada, evitando quebra funcional.

## Estágio 13 — Pagamentos
- Stripe Java adicionado ao backend.
- Checkout passou a ter implementação backend em `/api/v1/payments/checkout`.
- Total é recalculado a partir dos itens persistidos; status enviado pelo frontend não é confiável.
- Suporte a conta Stripe da plataforma ou Connected Account conforme dados do vendedor.
- Chaves Stripe ficam exclusivamente no backend.
- Webhooks TypeScript existentes foram preservados como fallback até validação end-to-end do webhook Java; não foram removidos prematuramente.

## Estágio 14 — Contratos
- `publisher_contracts` mapeada no backend.
- Editora consulta somente os próprios contratos em `/api/v1/contracts/me`.
- Listagem global exige ADMIN em `/api/v1/contracts`.
- O SQL existente `BOOKSYDE_CONTRATOS.sql` foi preservado; nenhuma tabela foi recriada automaticamente.
- Criação/upload legado foi preservado enquanto o upload backend é introduzido no estágio 15.

## Estágio 15 — Storage e arquivos
- Criado `FileStorageService` server-side para Supabase Storage.
- Service Role nunca é exposta ao frontend.
- Validação de tamanho, MIME, bucket permitido e path traversal.
- Endpoint de upload protegido para ADMIN/PUBLISHER/CREATOR.
- Tipos previstos: PDF, EPUB/ZIP, CBR/CBZ e imagens.
- Fluxos antigos de leitura/download continuam preservados para evitar regressões antes dos testes integrados.

## Pendências de validação
- Executar `mvn clean test` em ambiente com Maven/Java 21 e acesso às dependências.
- Executar `npm install && npm run build` no frontend.
- Testar Stripe sandbox end-to-end antes de remover rotas TypeScript antigas.
- Testar Supabase Storage com Service Role em ambiente de desenvolvimento.
- Testar tabela `publisher_contracts` no banco alvo antes de ativar endpoints em produção.
