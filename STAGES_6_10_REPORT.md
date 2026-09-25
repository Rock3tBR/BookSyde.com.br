# BookSyde — Estágios 6 a 10

## Estágio 6 — Camada API do frontend
Criada `front/src/api/` com cliente REST central, Bearer token obtido da sessão Supabase, erro padronizado e módulos de API. Marketplace, contratos e pagamentos ficaram explicitamente como fronteiras futuras, sem migração prematura.

## Estágio 7 — Módulo piloto de obras
Criado CRUD REST Java para a tabela histórica `mangas` (obra), com DTOs, mapper, service, repository, validação e ownership. O nome REST é `/api/v1/books`, enquanto o banco continua usando `mangas` para preservar compatibilidade.

## Estágio 8 — Obras, volumes e coleções
O mesmo modelo suporta `work_type` (`book`, `manga`, `hq`, `gibi`) e `is_collection`. Criada API de volumes, incluindo número 0. Não foi criada tabela paralela de obras/coleções.

## Estágio 9 — Usuários e perfis
Criados endpoints `/api/v1/profiles/me` para leitura/edição do perfil autenticado. Roles continuam resolvidas centralmente pelo backend a partir de `user_roles` e `marketplace_sellers`.

## Estágio 10 — Editoras e criadores
Criado endpoint editorial `/api/v1/publishers/me/dashboard`, restrito a PUBLISHER/CREATOR/ADMIN, sempre filtrado pelo usuário autenticado. Retorna quantidade de obras, volumes, visualizações e últimas obras.

## Compatibilidade
O frontend legado não foi reescrito em massa. As chamadas Supabase existentes continuam funcionando enquanto a nova API passa a existir em paralelo. Isso permite migrar telas uma por vez e reduz risco de regressão.
