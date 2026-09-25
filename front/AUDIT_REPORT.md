# Auditoria de Banco de Dados — BookSyde

**Data:** 2026-09-21  
**Objetivo:** Validar funcionalidade de fluxos críticos e RLS policies

## ✅ Validado — Funcionando

### Amizades
- ✅ `send_friend_request()` — criar pedido (idempotente)
- ✅ `respond_friend_request()` — aceitar/rejeitar
- ✅ `send_direct_message()` — enviar mensagem (validação de amizade)
- ✅ `mark_direct_messages_read()` — marcar como lida
- ✅ RLS: destinatário não lê mensagens de terceiros

### Estante Física
- ✅ CRUD em `physical_shelf_books` (insert, update, delete)
- ✅ Storage upload para bucket `physical-shelf`
- ✅ RLS: usuário só acessa próprios livros
- ✅ RLS: storage: terceiro não escreve em pasta alheia
- ✅ Campos de crop e aspect ratio persistem

### Busca
- ✅ `search_readers()` — busca por nome (com caracteres LIKE escapados)
- ✅ Busca por user_code com match exato
- ✅ Exclusão do próprio usuário

### Obras (Mangas)
- ✅ Criação simples (`INSERT`)
- ✅ Edição simples (`UPDATE`)
- ✅ RLS: usuário não edita obra privada de outro

## ⚠️ Problemas Identificados

### 1. Função `search_readers` — Escape de Regex (CORRIGIDO)
**Problema:** String regex com `\s` interpretada como escape inválido  
**Causa:** Falta de prefixo de string literal PostgreSQL  
**Solução:** Alterado de `'^\s*#\s*'` para `$$^\s*#\s*$$`  
**Status:** ✅ Corrigido em ambas as migrações

### 2. Criação de Obra — `invite_token` Bloqueado
**Problema:** RLS recusa leitura de `invite_token` mesmo para o proprietário  
**Detalhes:** `UPDATE ... RETURNING id, invite_token` falha com 42501  
**Causa:** Campo não possui grant explícito (proteção intencional)  
**Limitação:** App não pode ler invite_token após CREATE/UPDATE  
**Esperado:** Campo só é visível via funções SECURITY DEFINER  
**Status:** ⚠️ Comportamento confirmado (não é bug)

### 3. Grants de `physical_shelf_books` — Aplicados
**Problema:** Tabela sem grants explícitos para `authenticated`  
**Solução:** Adicionados grants GRANT SELECT,INSERT,UPDATE,DELETE  
**Status:** ✅ Corrigido na migração

## 📊 Cobertura de Testes

### Funções Testadas
- `send_friend_request()`
- `respond_friend_request()`
- `send_direct_message()`
- `mark_direct_messages_read()`
- `search_readers()`
- `save_library_folder()`
- `get_library_workspace()`

### Operações de Tabela
- `physical_shelf_books`: CRUD + RLS
- `storage.objects`: upload RLS
- `mangas`: INSERT, UPDATE, DELETE (com RLS)

### Cenários RLS
- Usuário lê próprios dados ✅
- Terceiro não lê dados alheios ✅
- Terceiro não escreve em storage alheio ✅
- Terceiro não edita obra privada alheia ✅

## 🔐 Limites da Auditoria

### Não Testado (Requer Acesso Autenticado Supabase)
- [ ] Autenticação real com `auth.users`
- [ ] Triggers de profile creation via `auth.users`
- [ ] Replicação de dados entre schemas
- [ ] Comportamento em concorrência
- [ ] Constraints de foreign keys do auth
- [ ] Comportamento de `auth.uid()` em transações

### Não Testado (Requer Setup Específico)
- [ ] Marketplace: publicação, compra, reviews
- [ ] Denúncias e moderação
- [ ] Pagamentos (Stripe integration)
- [ ] Email triggers
- [ ] Uploads de mídia (PDF, imagens grandes)
- [ ] Permissões de admin/moderador

### Scope de Auditoria
- ✅ RLS policies (select, insert, update, delete)
- ✅ Storage policies
- ✅ Função SQL (search_readers)
- ✅ Grants (REVOKE/GRANT)
- ⚠️ Integração com auth.users (partial)
- ❌ API REST (PostgREST routes)
- ❌ Webhooks
- ❌ Realtime subscriptions

## 🛠️ Próximas Etapas

1. **Deploy das migrações** em staging
2. **Teste de integração** de amizades em produção
3. **Auditoria de marketplace** (publicação, compra)
4. **Teste de concorrência** em physical_shelf
5. **Validação de admin permissions** para moderação

## 📋 Artefatos

- `tests/database-flows.sql` — Suite de testes PL/pgSQL
- `tests/fixtures/full-schema-platform.sql` — Schema completo para testes
- `scripts/audit-database-contract.mjs` — Validação de contrato (código ↔ DB)
- Migrações:
  - `supabase/migrations/20260921230000_search_and_physical_shelf_access.sql`
  - `SQL_CORRECAO_BUSCA_E_ESTANTE.sql` (correção ponual)
