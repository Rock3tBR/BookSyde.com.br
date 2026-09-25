# Execução e validação

## Frontend
1. Copie `front/.env.example` para `front/.env.local` e preencha as variáveis públicas.
2. `cd front && npm install`
3. `npm run build`
4. `npm test` para Playwright quando o ambiente de teste estiver configurado.

## Backend
Requer Java 21 e Maven 3.9+.
1. Copie `back/.env.example` para o mecanismo de secrets do ambiente.
2. Configure `DATABASE_*`, `SUPABASE_URL` e as chaves server-side necessárias.
3. `cd back && mvn clean test`
4. `mvn spring-boot:run`
5. Health: `GET /api/v1/public/health`. Swagger: `/swagger-ui.html`.

## Deploy
- Não use `VITE_` para secrets.
- Configure `CORS_ALLOWED_ORIGINS` somente com origens reais.
- Use HTTPS.
- Execute migrations em ambiente controlado antes da aplicação.
- Faça smoke test de login, leitura, upload, marketplace, checkout e webhooks antes de promover produção.
