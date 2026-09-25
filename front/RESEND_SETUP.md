# Resend no BookSyde

O projeto já está preparado para os três fluxos pedidos:

1. **Confirmar conta** — já usa `supabase.auth.signUp()` em `src/pages/auth.tsx`. O Supabase Auth envia o e-mail de confirmação. Configure o SMTP do Auth com o Resend (passos abaixo).
2. **Trocar senha** — já usa `supabase.auth.resetPasswordForEmail()` e `updateUser()` em `src/pages/auth.tsx`. O e-mail de recuperação também sai pelo SMTP do Supabase Auth.
3. **Venda no Marketplace** — após o webhook Stripe validar o pagamento e executar `fulfill_marketplace_order`, `src/routes/api/public/marketplace/webhook.ts` chama a Edge Function `notify-seller-sale`, que consulta o e-mail do vendedor com Service Role e envia a notificação via Resend.

## 1. Secret

Você já criou `RESEND_API_KEY` nos Secrets do Supabase. Não use `VITE_RESEND_API_KEY`.

## 2. Deploy da função

```bash
supabase functions deploy notify-seller-sale --no-verify-jwt
```

A função faz sua própria validação e só aceita `SUPABASE_SERVICE_ROLE_KEY`. O endpoint não aceita chamadas públicas.

## 3. SMTP do Supabase Auth (necessário para confirmação e troca de senha)

No Dashboard do Supabase, abra **Authentication > SMTP Settings** e ative Custom SMTP.
Use os dados SMTP mostrados atualmente no painel/documentação do Resend. Como credencial, use uma API key do Resend com permissão de envio. Configure o remetente como `BookSyde <noreply@booksyde.com.br>`.

Depois, em **Authentication > URL Configuration**, confirme que `Site URL` aponta para a URL pública do BookSyde e inclua a URL pública `/auth` nas Redirect URLs. O código já envia a recuperação para `${window.location.origin}/auth`.

## 4. Templates do Supabase Auth

Em **Authentication > Email Templates**, personalize pelo menos **Confirm signup** e **Reset password** com a identidade do BookSyde. Preserve os placeholders/links de confirmação gerados pelo Supabase no template; não substitua por links fixos.

## Segurança

- A API key do Resend fica somente no Supabase.
- O navegador não escolhe destinatário da notificação de venda.
- A função busca o vendedor pelo `seller_id` do pedido já pago.
- A notificação é disparada somente depois da validação do webhook Stripe.
- Falha no Resend não cancela uma compra já paga.
