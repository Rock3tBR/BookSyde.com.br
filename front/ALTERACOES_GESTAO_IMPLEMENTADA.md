# Mangaka — reestruturação implementada da gestão

Versão de trabalho: 16/09/2026. Base: `Mangaka_moderacao_atualizado(1).zip`.

## O que foi alterado no código

- Header principal específico para **admin**, **vendedor** e **editora**, preservando os demais perfis. Admin mostra Home, Marketplace, Estúdio, Biblioteca, Dashboard e Administração; o avatar contém acesso à própria loja. Vendedor tem Home, Marketplace, Estúdio, Biblioteca, Minha loja e Personalização. Editora tem Home, Dashboard, Estúdio, Biblioteca e Gestão editorial.
- Navegação de gestão extraída para `src/components/ManagementNavigation.tsx`: sidebar contextual agrupada no desktop e menu lateral temporário no celular. A sidebar só aparece nas áreas de gestão, nunca no site inteiro.
- Administração: rotas independentes em `/admin/dashboard`, `/admin/moderacao`, `/admin/usuarios`, `/admin/marketplace`, `/admin/anuncios`, `/admin/pedidos`, `/admin/denuncias`, `/admin/reembolsos`, `/admin/suporte`, `/admin/assinaturas`, `/admin/financeiro` e `/admin/doacoes`. O dashboard não contém mais a barra de abas de navegação.
- Marketplace administrativo: funcionalidades preservadas no `MarketplaceAdminPanel`, com seleção de módulo pela **rota** e não mais por abas. Os controles de revisão, pedidos, suporte e reembolso permanecem nas páginas próprias.
- Vendedor: `/vendedor`, `/vendedor/pedidos`, `/vendedor/publicacoes`, `/vendedor/financeiro`, `/vendedor/loja`. O componente já existente conserva criação de coleção, pausas de anúncios, recebimentos Stripe, conversas e configuração da loja. A antiga `/marketplace/vendedor` continua funcionando para compatibilidade com os retornos Stripe existentes.
- Editora: `/editora`, `/editora/catalogo`, `/editora/contratos`, `/editora/financeiro`, `/editora/relatorios`, `/editora/configuracoes`. Listagem isolada por `creator_id = usuário autenticado`; administração vê apenas as próprias obras ao entrar nessa visualização. Não se concede acesso a acervos de outras organizações.
- `src/lib/access.ts` passa a bloquear no guard de interface todas as rotas administrativas não autorizadas, mesmo se a URL for acessada diretamente. Isso **não substitui RLS nem autorização no servidor**.
- No financeiro, os dados expostos são identificados como **venda bruta observada** e os ambientes de teste e produção não são misturados na apuração administrativa. Não se chama faturamento bruto de lucro ou saldo disponível.
- Os novos arquivos de rota foram incorporados ao `src/routeTree.gen.ts` e à cópia legada da raiz. No primeiro `vite dev`/`vite build`, a geração automática do TanStack Router poderá reescrevê-los normalmente.

## Integrações que não foram inventadas

O ZIP não comprova a existência das tabelas de contratos, royalties, repasses e conciliação Stripe/assinaturas no banco efetivamente publicado. Portanto, **não foram criadas operações falsas** de aprovação contratual, pagamento de royalties, saldo disponível, conciliação, MRR ou saques. As respectivas áreas exibem mensagem explícita de integração pendente. Assinaturas exibe somente a quantidade de contas com acesso Plus disponível na RPC existente, diferenciando-a de assinantes pagantes.

**Antes de colocar em produção:** criar e testar backend de licenças por obra, organizações e memberships, RLS por escopo, lançamentos financeiros imutáveis, webhook Stripe verificado e idempotente, reconciliação de reembolsos/repasse, e o modelo fiscal/contratual validado. Não alteramos preço de plano nem regras financeiras existentes sem confirmação.

## Verificações realizadas neste ambiente

- Análise sintática de **179 arquivos TS/TSX** com o parser TypeScript: nenhum erro de parsing.
- Verificação estática de cobertura das rotas novas no arquivo gerado: rotas encontradas.
- Build completo / Playwright **não executados**: `npm ci --offline` falhou por dependência ausente no cache (`zod@3.25.76`); a tentativa online não concluiu. Execute `npm ci && npm run build && npm test` em um ambiente com dependências disponíveis, e teste com contas reais de cada papel.

## Checklist funcional para homologação

1. Admin: abrir separadamente dashboard, usuários, moderação, anúncios, pedidos, suporte, denúncias, reembolsos, assinaturas e financeiro; confirmar ações e estados.
2. Admin vendedor: vender pela própria loja sem consultar pedidos de outro vendedor na visão da loja.
3. Vendedor A/B: testar que pedidos, anúncios e informações da loja não atravessam contas, inclusive consultas diretas ao Supabase e endpoints.
4. Editora A/B: confirmar que catálogo e compras ficam limitados à sua conta; testar permissões organizacionais antes de habilitar equipe editorial.
5. Stripe: checkout bem-sucedido/fracassado, retorno de onboarding antigo, ativação e reembolso; verificar `live` e `sandbox` separadamente.
6. Mobile: 320/360/390px, abrir sidebar, navegar sem scroll horizontal nem zoom indesejado; verificar edição/moderação e teclado.
7. Verificar contrato e licença de cada obra antes de disponibilizar em assinatura ou redistribuição.
