# BookSyde — Relatório dos Estágios 2 a 5

## Estágio 2 — Base do backend
Implementado: estrutura modular, CORS explícito por variável de ambiente, OpenAPI/Swagger, resposta de erro padronizada, tratamento global de exceções e configuração de logs/environments.

## Estágio 3 — Banco de dados
Implementado: Spring Data JPA, PostgreSQL, Flyway e mapeamento inicial de `profiles`, `user_roles` e `marketplace_sellers`. O Hibernate está com `ddl-auto=none` para não alterar automaticamente o schema Supabase existente. A V1 do Flyway é um baseline sem DDL; o schema atual não é recriado.

## Estágio 4 — Autenticação
Estratégia escolhida: manter Supabase Auth durante a migração e fazer o Spring Boot atuar como Resource Server. O backend valida assinatura via JWKS do projeto Supabase, issuer e audience. O endpoint `GET /api/v1/auth/me` resolve identidade pelo `sub` do JWT, e-mail do token, perfil e roles do banco.

Limitação preservada do banco atual: não existe status global de conta na estrutura encontrada. `marketplace_sellers.suspended_at` representa suspensão do vendedor, não suspensão global do usuário. Por isso o backend não inventa uma coluna/status inexistente; vendedor suspenso simplesmente não recebe a role derivada `SELLER`.

## Estágio 5 — Autorização e segurança
Implementado: Spring Security stateless, Bearer JWT, Method Security, enum central de roles e `AuthorizationService` para checks de role e ownership. O banco atual usa `admin`, `user`, `creator`, `editora`; o Java normaliza `editora -> PUBLISHER` e deriva `SELLER` da tabela `marketplace_sellers`, sem alterar o enum PostgreSQL atual.

## Compatibilidade
Nenhuma chamada atual do frontend foi redirecionada. Nenhuma API TypeScript foi removida. Nenhuma tabela foi recriada. Nenhuma migration Supabase existente foi alterada. Isso preserva o sistema atual enquanto a nova API é construída em paralelo.

## Validação disponível neste ambiente
- Estrutura e arquivos: verificados.
- Maven: não disponível no ambiente, então `mvn clean test` não pôde ser executado aqui.
- Dependências do frontend: `node_modules` não está instalado neste snapshot; o build frontend não foi reexecutado. O frontend não foi modificado nos Estágios 2–5.

## Próximo estágio
Estágio 6: criar a camada `front/src/api/` e centralizar cliente HTTP/token/erros, sem migrar módulos de negócio ainda.
