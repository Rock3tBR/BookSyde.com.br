# Arquitetura BookSyde

## Visão geral

```text
React + TypeScript + Vite (/front)
        | HTTPS / REST + Supabase JWT
        v
Java 21 + Spring Boot (/back)
        | JPA / integrações server-side
        v
PostgreSQL / Supabase
```

O Supabase Auth permanece como provedor de identidade. O backend valida o JWT e decide autorização/ownership. Operações privilegiadas, Stripe, Resend, Storage e Google Drive devem permanecer server-side.

## Backend
- `controller`: contrato HTTP.
- `dto`: requests/responses.
- `service`: regras de negócio.
- `repository`: persistência.
- `entity`: mapeamento JPA do schema existente.
- `security`: JWT, roles e autorização.
- `config`: CORS, OpenAPI e filtros.
- `exception`: erros públicos padronizados.

## Frontend
Novas chamadas backend devem passar por `front/src/api/apiClient.ts`. Acesso direto legado ao Supabase deve ser removido apenas depois de cada fluxo equivalente estar validado end-to-end.
