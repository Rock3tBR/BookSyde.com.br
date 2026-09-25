# Autenticação do BookSyde em produção

O frontend usa o projeto configurado em `VITE_SUPABASE_URL` tanto para e-mail quanto para Google. Os fluxos de cadastro, reenvio, recuperação de senha e Google retornam para `/auth` na origem onde o usuário iniciou o acesso.

## Configuração necessária no Supabase

No projeto `tdpyfqtrasnzbeslinqw`, abra **Authentication → URL Configuration**:

- **Site URL:** `https://booksyde.com.br`
- **Redirect URLs:** adicione `https://booksyde.com.br/auth` e `https://booksyde.com.br` (compatibilidade com cadastros anteriores).
- Se também usar `www`, autorize explicitamente essa origem e seu caminho `/auth`.
- Para desenvolvimento local e previews do Lovable, autorize separadamente as origens usadas. O Site URL de produção deve continuar sendo o domínio publicado.

Em **Authentication → Email Templates → Confirm signup**, use `{{ .ConfirmationURL }}` no link de confirmação. Não coloque `localhost` nem substitua o link de verificação por um link direto para a página inicial.

## Google

1. No Google Cloud, configure a tela de consentimento e crie credenciais OAuth do tipo **Web application**.
2. Configure a origem JavaScript `https://booksyde.com.br`.
3. Cadastre como URI de redirecionamento autorizada **`https://tdpyfqtrasnzbeslinqw.supabase.co/auth/v1/callback`**. Esse é o retorno do Google para o Supabase; `/auth` é o retorno posterior para o site.
4. No Supabase, abra **Authentication → Sign In / Providers → Google**, habilite o provedor e salve o Client ID e o Client Secret do Google Cloud. O segredo fica no painel, nunca em variáveis `VITE_*`.
5. Ajuste o público/tela de consentimento do Google para permitir os usuários esperados. Em modo de testes, somente os usuários autorizados no Google Cloud terão acesso.

## Verificação após publicar

- Solicite um novo e-mail pelo formulário de confirmação. Teste a confirmação em uma janela sem sessão: deve voltar ao domínio publicado e manter a conta autenticada.
- Teste o login Google com uma conta autorizada e também o cancelamento do consentimento.
- Teste a recuperação de senha para garantir que o retorno mostra o formulário de nova senha.

Em diagnóstico de 23/09/2026, o endpoint público de verificação redirecionou para `http://localhost:3000` e o endpoint Google respondeu `Unsupported provider: provider is not enabled`. O primeiro teste usou deliberadamente um token inválido apenas para observar o endereço de retorno; não demonstra que o link recebido pelo usuário expirou. Essas configurações exigem acesso administrativo ao painel e não são alteradas por um deploy do frontend.

Referências: [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
