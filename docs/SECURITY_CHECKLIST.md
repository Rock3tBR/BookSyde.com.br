# Checklist de segurança

- [x] JWT validado pelo backend com issuer e audience.
- [x] Sessão stateless no Spring Security.
- [x] Ownership aplicado nos serviços migrados.
- [x] CORS por allowlist configurável.
- [x] Secrets server-side fora de `VITE_*`.
- [x] Upload com limite, MIME allowlist, bucket allowlist e path sanitizado.
- [x] Erros 500 sem stack trace para o cliente.
- [x] Security headers básicos e `X-Request-Id`.
- [ ] Rate limiting distribuído no gateway/proxy de produção.
- [ ] Validar webhooks Stripe com assinatura em teste end-to-end antes do corte do legado.
- [ ] Rodar SAST/dependency scan no CI.
- [ ] Remover endpoints TypeScript legados somente após equivalência validada.
