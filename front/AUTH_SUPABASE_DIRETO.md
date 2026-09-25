# Autenticação BookSyde — Supabase direto

O frontend não usa Lovable Cloud para autenticação. E-mail/senha e Google usam `supabase.auth` diretamente.

## Supabase Dashboard

Em **Authentication > URL Configuration** configure:
- Site URL: `https://booksyde.com.br`
- Redirect URLs: `https://booksyde.com.br/auth` e, se necessário no desenvolvimento, `http://localhost:3000/auth`.

Em **Authentication > Providers > Google**, habilite Google e configure Client ID e Client Secret do Google Cloud.

No Google Cloud, o **Authorized redirect URI** do OAuth deve ser o callback exibido pelo Supabase, normalmente:
`https://SEU_PROJECT_REF.supabase.co/auth/v1/callback`

## Variáveis do site

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- no servidor, quando necessário: `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`

Execute `BOOKSYDE_AUTH_SUPABASE_DIRETO.sql` no SQL Editor do Supabase antes do teste.
