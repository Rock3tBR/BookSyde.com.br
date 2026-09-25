# Booksyde: correção adicional da listagem

## Causa eliminada no frontend
A versão anterior listava via `GET /api/admin-users`, uma rota de servidor que precisava de `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` no *runtime* de hospedagem. O login pode funcionar no navegador mesmo quando essas duas variáveis estão ausentes no servidor ou a rota não está publicada adequadamente. Isso é uma **hipótese de falha detectada no fluxo**, não um diagnóstico confirmado do ambiente publicado.

A listagem em `src/pages/admin.tsx` agora consulta `supabase.rpc('booksyde_admin_list_users')` usando o mesmo cliente autenticado que faz o login. O banco verifica `auth.uid()` e o papel `admin`; nenhuma chave privilegiada é colocada no frontend. As operações de escrita do painel continuam usando `POST /api/admin-users` e exigem chave privilegiada SOMENTE no servidor.

## Passos
1. Publicar **este** ZIP (não o ZIP da correção anterior).
2. No SQL Editor do mesmo projeto do login, executar `sql/repair/05_listagem_usuarios_admin.sql` (se não foi executado ainda).
3. Recarregar o Booksyde e acessar Administração → Usuários. Se houver falha, a tela exibe código/explicação de erro.
4. Se persistir, execute `sql/repair/06_diagnostico_listagem.sql` e compartilhe **somente os campos booleanos e total**, sem e-mails, chaves ou tokens. Envie também o texto da caixa de erro da tela (não informações sensíveis da aba Network).

Não é necessário alterar nem desativar as políticas RLS. Não foi possível testar a conexão com o Supabase ou a implantação de produção neste ambiente.
