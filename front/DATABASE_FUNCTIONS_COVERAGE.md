# Cobertura de Funções do Banco — BookSyde

Mapeamento de todas as funções RPC usadas pelo código TypeScript vs. testes.

## 📋 Resumo

- **Total de funções RPC:** 34
- **Testadas:** 7 (20%)
- **Não testadas:** 27 (80%)
- **Status de build:** ✅ Passando

## ✅ Testadas (7/34)

### Amizades & Mensagens
- `send_friend_request()` — ✅ **TESTADO**
- `respond_friend_request()` — ✅ **TESTADO**
- `send_direct_message()` — ✅ **TESTADO**
- `mark_direct_messages_read()` — ✅ **TESTADO**

### Busca
- `search_readers()` — ✅ **TESTADO** (corrigido em 73fcef8c)

### Biblioteca
- `save_library_folder()` — ✅ **TESTADO**
- `get_library_workspace()` — ✅ **TESTADO**

---

## ⏳ Não Testadas (27/34)

### Marketplace (12 funções)
| Função | Tipo | Risco | Prioridade |
|--------|------|-------|-----------|
| `upsert_marketplace_listing()` | CRUD | Alto | 🔴 Crítica |
| `create_marketplace_order()` | Create | Alto | 🔴 Crítica |
| `fulfill_marketplace_order()` | Update | Alto | 🔴 Crítica |
| `redeem_marketplace_order()` | Update | Médio | 🟠 Alta |
| `request_marketplace_refund()` | Create | Alto | 🔴 Crítica |
| `set_marketplace_listing_active()` | Update | Baixo | 🟡 Média |
| `report_marketplace_listing()` | Create | Baixo | 🟡 Média |
| `get_marketplace_order_details()` | Read | Médio | 🟡 Média |
| `get_similar_marketplace_listings()` | Read | Baixo | 🟢 Baixa |
| `redeem_marketplace_code()` | Update | Médio | 🟡 Média |
| `update_marketplace_seller_profile()` | Update | Baixo | 🟡 Média |
| `create_catalog_order_server()` | Create | Alto | 🔴 Crítica |

### Leitura & Analytics (5 funções)
| Função | Tipo | Risco | Prioridade |
|--------|------|-------|-----------|
| `increment_manga_view()` | Update | Baixo | 🟢 Baixa |
| `add_reading_time()` | Create | Baixo | 🟡 Média |
| `record_system_access()` | Create | Baixo | 🟢 Baixa |
| `get_reader_profiles()` | Read | Médio | 🟡 Média |
| `can_access_manga()` | Read | Alto | 🔴 Crítica |

### Compartilhamento & Convites (6 funções)
| Função | Tipo | Risco | Prioridade |
|--------|------|-------|-----------|
| `generate_library_share()` | Create | Médio | 🟡 Média |
| `redeem_library_share()` | Update | Médio | 🟡 Média |
| `share_code_with_friend()` | Create | Baixo | 🟡 Média |
| `redeem_friend_share_code()` | Update | Médio | 🟡 Média |
| `redeem_manga_invite()` | Update | Alto | 🔴 Crítica |

### Admin (3 funções)
| Função | Tipo | Risco | Prioridade |
|--------|------|-------|-----------|
| `get_admin_dashboard()` | Read | Médio | 🟡 Média |
| `create_support_request()` | Create | Baixo | 🟡 Média |

---

## 🎯 Próximas Etapas de Teste

### 🔴 Críticas (Recomendado testar em staging)
1. `can_access_manga()` — RLS de acesso a obra
2. `create_marketplace_order()` — Pagamento e isolamento
3. `fulfill_marketplace_order()` — Confirmação de venda
4. `request_marketplace_refund()` — Reembolso seguro
5. `create_catalog_order_server()` — Catálogo
6. `redeem_manga_invite()` — Convites de obra

### 🟠 Altas
1. `redeem_marketplace_order()` — Resgatar código
2. `get_marketplace_order_details()` — Acesso a detalhes
3. `get_reader_profiles()` — Busca de perfis

### 🟡 Médias
1. Restante de compartilhamento
2. Restante de analytics
3. Admin dashboard

---

## 📊 Análise de Risco

### Por Funcionalidade
```
Amizades/Mensagens      ████████████████ 100% ✅
Estante Física          ████████████████ 100% ✅
Biblioteca              ████████████████ 100% ✅
Busca                   ████████████████ 100% ✅
──────────────────────────────────────────────
Marketplace             ░░░░░░░░░░░░░░░░   0% ❌
Leitura/Analytics       ░░░░░░░░░░░░░░░░   0% ❌
Compartilhamento        ░░░░░░░░░░░░░░░░   0% ❌
Admin                   ░░░░░░░░░░░░░░░░   0% ❌
```

### Funcionalidades Críticas não Testadas
1. **Marketplace** — 12 funções, fluxo de pagamento/reembolso
2. **Acesso a Obras** — `can_access_manga()` é uma porta crítica
3. **Convites** — `redeem_manga_invite()` valida permissões

---

## 🔍 Como Executar os Testes

### Testes Atuais
```bash
# Em um PostgreSQL descartável com fixture de plataforma:
psql -U postgres -d test_db -f tests/fixtures/full-schema-platform.sql
psql -U postgres -d test_db -f tests/database-flows.sql
```

### Como Adicionar Novos Testes
1. Adicione a função de teste em `tests/database-flows.sql`
2. Use helpers `pg_temp.check_true()` e `pg_temp.expect_error()`
3. Execute a transação (será revertida automaticamente)

---

## 📝 Notas

- **Escopo original da auditoria:** RLS, amizades, estante (completado ✅)
- **Fora do escopo original:** Marketplace, admin, analytics
- **Requer acesso Supabase:** Testes de auth real, webhooks, realtime
- **Contrato de banco:** Validado com `scripts/audit-database-contract.mjs`

---

**Última atualização:** 2026-09-21  
**Autor:** Claude Haiku 4.5  
**Próxima revisão recomendada:** Após deploy de marketplace em staging
