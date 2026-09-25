# Status da migração

Estágios 0–20: base arquitetural e módulos Java preparados.

## Estágio 21 — Refatoração frontend
A camada `src/api` foi consolidada em um único cliente HTTP com token, timeout, request-id e erro padronizado. Arquivos legados grandes permanecem para evitar regressão até seus fluxos estarem totalmente cobertos.

## Estágio 22 — Duplicação
O cliente HTTP duplicado foi eliminado via alias temporário `apiClient = apiRequest`. Utilitários e chamadas Supabase legadas ainda devem ser eliminados módulo a módulo, não por busca/substituição cega.

## Estágio 23 — Performance
Mantidos pool Hikari e JPA sem Open Session in View. Índices não foram criados automaticamente: o schema real de produção deve ser medido com `EXPLAIN ANALYZE` antes de migrations de performance.

## Estágio 24 — Hardening
Adicionados headers, request-id, limites multipart e proteção de mensagens de erro. Rate limiting deve ser aplicado no gateway/proxy para funcionar corretamente em múltiplas instâncias.

## Estágio 25 — Testes finais
Foram adicionados testes unitários do validador de audience. Builds completos dependem das dependências locais e credenciais/serviços externos; não são considerados aprovados sem execução real.

## Estágio 26 — Limpeza
Não foi removido legado funcional ainda usado pelo frontend. A remoção prematura violaria a regra de preservar funcionalidades. Artefatos temporários de sistema podem ser excluídos com segurança.

## Estágio 27 — Documentação
Criados `ARCHITECTURE.md`, `RUNBOOK.md`, `SECURITY_CHECKLIST.md` e este relatório.
