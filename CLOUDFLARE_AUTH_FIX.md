# Cloudflare + Supabase Auth

## Obrigatório no Supabase Dashboard
Authentication > URL Configuration

Site URL (durante testes):
https://fsantos15-mangakalib.booksyde.workers.dev

Redirect URLs:
- https://fsantos15-mangakalib.booksyde.workers.dev/**
- https://booksyde.com.br/**

Quando booksyde.com.br virar produção, altere Site URL para https://booksyde.com.br.

Links de confirmação antigos que foram emitidos quando Site URL era localhost:3000 continuarão apontando para localhost. Reenvie a confirmação depois de salvar as URLs.

## Alterações no código
- timeout de 12s para chamadas Supabase;
- queries React Query com apenas 1 retry;
- callback /auth deixa de ficar bloqueado indefinidamente após 8s;
- redirects de cadastro, reenvio, reset e Google usam window.location.origin.
