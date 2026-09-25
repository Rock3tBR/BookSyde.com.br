# Correção: `permission denied for table mangas`

A migração principal retira o `SELECT` amplo de `mangas` para proteger `invite_token`, `licensed_purchase_url` e `licensed_store_name`. A página de administração ainda requisitava essas três colunas diretamente tanto na listagem quanto no `INSERT ... RETURNING` e `UPDATE ... RETURNING`, provocando o erro 42501.

## Instalação
1. Execute `SQL_CORRIGIR_CRIACAO_OBRAS.sql` no SQL Editor do projeto Supabase usado pelo site.
2. Publique este código atualizado. O SQL sozinho não corrige o SELECT indevido feito pelo código anterior.
3. Recarregue a página, crie a obra e acompanhe a etapa de upload do volume.

A nova RPC retorna metadados confidenciais só para criador da obra e admin autenticado; não há `GRANT SELECT` amplo nem desligamento de RLS. No cadastro, uma falha de consulta do convite após o INSERT não gera segunda obra automaticamente.

Sem conexão ao projeto publicado, não foi possível executar teste de ponta a ponta nem validar as políticas específicas presentes na sua instância.
