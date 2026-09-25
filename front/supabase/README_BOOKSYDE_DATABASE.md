# Banco BookSyde

Para corrigir o CRUD em um banco existente, consulte [CORRECAO_CRUD.md](../CORRECAO_CRUD.md) e aplique [SQL_REPARAR_CRUD.sql](../SQL_REPARAR_CRUD.sql) antes de publicar o código atualizado. O bootstrap abaixo é somente para bancos novos.

O schema canônico do projeto está em:

`supabase/migrations/20260921183000_booksyde_full_schema.sql`

As migrações antigas foram movidas para `supabase/migrations_legacy/` porque o schema completo já incorpora as alterações reconstruídas a partir delas. Mantê-las na pasta ativa faria um banco novo executar alterações duplicadas após o bootstrap.

## Variáveis usadas pelo app

O cliente Supabase usa:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

No SSR também há fallback para:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Nunca coloque `service_role`/secret key em variáveis `VITE_*`.

## Novo projeto Supabase

1. Aplique a migration canônica ao banco novo (SQL Editor ou fluxo de migrations do Supabase).
2. Configure URL e publishable key do mesmo projeto nas variáveis de ambiente.
3. Configure os secrets das Edge Functions separadamente (Stripe/webhooks etc.).
4. Crie o primeiro usuário pelo Supabase Auth e depois atribua `admin` em `public.user_roles`.
