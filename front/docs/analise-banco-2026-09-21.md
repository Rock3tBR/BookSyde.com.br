# Análise da conexão e do banco BookSyde

Análise por consultas HTTP somente de leitura com a chave pública, pelo código da aplicação e pelo SQL `supabase/migrations/20260921183000_booksyde_full_schema.sql`. Não foram criados usuários, enviados e-mails nem alterados dados ou permissões no Supabase.

## Problemas confirmados na configuração local

- O frontend apontava para `gxkonwfcnqicqbwbxefd.supabase.co`, que retornou erro de resolução DNS mesmo fora do sandbox.
- O servidor apontava para o projeto novo `tdpyfqtrasnzbeslinqw`, mas sua URL terminava em `/rest/v1/`. O SDK acrescenta os caminhos dos serviços; as consultas com essa base retornaram HTTP 404 / PGRST125.
- As chaves públicas e os identificadores de projeto de navegador/servidor estavam diferentes. O `.env` local foi alinhado ao projeto novo, cuja chave pública foi validada por consultas HTTP. Nenhuma chave privada foi colocada no frontend.
- `SUPABASE_SERVICE_ROLE_KEY` não está configurada no ambiente local. O cliente administrativo exige essa variável. Isso bloqueia criar usuários pelo painel administrativo e outros endpoints que usam esse cliente. A configuração do ambiente publicado não foi acessada.

Reinicie o servidor local após mudar o `.env`. Na hospedagem, aplique as mesmas URLs/identificadores e a chave pública do projeto novo; a variável de serviço deve ser configurada exclusivamente no servidor. Variáveis `VITE_*` exigem nova compilação/publicação.

## Resultado das consultas ao projeto novo

Usando a origem correta `https://tdpyfqtrasnzbeslinqw.supabase.co`:

- Auth `/auth/v1/settings`: HTTP 200, cadastro habilitado, e-mail habilitado e confirmação de e-mail exigida. Isso não testa SMTP nem a execução do gatilho ao cadastrar.
- Consulta básica de `mangas`: HTTP 200.
- Consulta da Home com os campos usados pelo aplicativo: HTTP 200, nenhum registro visível ao visitante. Não permite concluir que a tabela inteira esteja vazia.
- Consulta de `mangas.invite_token`, `volumes.source_path` ou `pages.storage_path`: HTTP 401, código PostgreSQL 42501, acesso negado para visitante. Essa restrição aos campos sensíveis não deve ser removida indiscriminadamente.

## Incompatibilidades entre o SQL novo e o aplicativo

1. **Criação e edição de obras:** o aplicativo faz `insert(...).select(...invite_token...)` e também consulta esse campo na listagem do Estúdio. O SQL revoga SELECT da tabela e não inclui `invite_token` nas concessões por coluna, nem para `authenticated`. A política de proprietário não substitui a permissão de coluna; portanto o contrato do SQL não atende a essas consultas.
2. **Página da obra:** consulta `licensed_purchase_url` e `licensed_store_name`, também ausentes da lista de colunas liberadas pelo SQL. São metadados usados para indicar a fonte licenciada.
3. **Catálogo de criadores:** o frontend permite publicar uma obra gratuita no Catálogo a partir do Estúdio; o gatilho `enforce_admin_catalog_publication` do SQL rejeita publicações públicas no Catálogo quando o usuário não é administrador. É necessário definir uma única regra e aplicá-la na interface e no banco.
4. **Perfis recém-criados:** `handle_new_user` atribui somente o papel `user`; o frontend não permite a esse papel acessar o Estúdio. O script não cria automaticamente um primeiro administrador. O diagnóstico SQL permite verificar os papéis sem expor identidades.
5. **Leitura e metadados de arquivos:** o banco restringe caminhos de arquivos e oferece RPCs/fluxos de servidor, enquanto ainda há consultas diretas a `pages.storage_path` no frontend. Deve-se adaptar essas consultas ao acesso autorizado, preservando o isolamento dos arquivos.

O SQL v3 é uma instalação para banco novo: aborta quando `public.profiles` já existe. O uso de `IF NOT EXISTS` não o transforma em um script de reparo executável repetidamente.

## Próxima verificação no SQL Editor

Execute [04_diagnostico_instalacao.sql](../sql/repair/04_diagnostico_instalacao.sql), como `postgres`, no projeto novo. Retorna contagens, permissões, gatilhos, políticas e buckets, sem alterar o banco. Isso confirma o estado instalado de funções/papéis; a chave pública não permite inspecionar esses dados administrativos.

Para corrigir a publicação sem expor convites, use consultas/RPCs que retornem `invite_token` apenas ao proprietário ou administrador; não conceda SELECT amplo a `anon`/`authenticated` para contornar a falha. Não é necessário recriar o banco nem desativar RLS.
