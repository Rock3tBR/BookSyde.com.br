# Correção — sessão na importação do Google Drive

- A importação agora busca a sessão atual diretamente no Supabase no momento do clique.
- O `access_token` atual é enviado como `Authorization: Bearer ...`.
- O backend valida o JWT com o cliente administrativo do mesmo projeto Supabase.
- Remove a dependência da chave pública do runtime do servidor para validar a sessão.
- Nenhum volume/arquivo existente foi removido ou migrado.
