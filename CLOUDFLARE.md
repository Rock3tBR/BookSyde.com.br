# BookSyde no Cloudflare

O frontend é publicado como Worker/Nitro.

## Build e deploy

```bash
npm install
npm run build
npx nitro deploy --prebuilt
```

## Secrets necessários no Worker

As variáveis `VITE_*` usadas no navegador são incorporadas durante o build. Rotas server-side do Google Drive também precisam das variáveis abaixo no runtime do Worker:

```bash
npx wrangler secret put GOOGLE_DRIVE_API_KEY
npx wrangler secret put BOOKSYDE_DRIVE_PROXY_SECRET
```

`BOOKSYDE_DRIVE_PROXY_SECRET` deve ser uma string aleatória longa. Não a versione no Git.

Depois de alterar secrets, faça novo build/deploy para manter o ambiente validado.
