# BookSyde Backend — Estágios 2 a 5

Base Java/Spring Boot criada sem substituir ainda as APIs do frontend.

## Configuração
1. Copie `.env.example` para o mecanismo de secrets/variáveis do ambiente. Não versione `.env`.
2. Configure `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD` e `SUPABASE_URL`.
3. Use o access token do Supabase no header `Authorization: Bearer <token>`.

## Banco e Flyway
O schema BookSyde já existia antes do backend Java. `V1__baseline_existing_booksyde_schema.sql` é deliberadamente no-op. `baseline-on-migrate=true` evita que o Flyway tente recriar o banco existente. Mudanças futuras entram em V2+ após validação do schema real.

## Auth
O backend valida o JWT do Supabase via JWKS oficial do próprio projeto e exige issuer/audience corretos. `/api/v1/auth/me` resolve `userId`, `email`, roles e perfil pelo backend. `editora` é normalizado para `PUBLISHER`; vendedor ativo em `marketplace_sellers` recebe `SELLER`.

## Comandos
```bash
mvn clean test
mvn spring-boot:run
```
Swagger: `/swagger-ui.html`.
