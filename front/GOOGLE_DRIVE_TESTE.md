# Teste de arquivos no Google Drive

Esta alteração é **aditiva**. Nada do Supabase Storage foi removido ou migrado.

## Como funciona

- O catálogo, usuários, permissões e metadados continuam no Supabase.
- Apenas o arquivo-fonte de volumes escolhidos (EPUB e outros fluxos que usam `volume-sources`) pode vir do Google Drive.
- O acesso continua sendo validado primeiro pelas RPCs atuais do Supabase.
- Se o volume não estiver em `BOOKSYDE_DRIVE_FILES`, o BookSyde usa o Supabase normalmente.
- O ID e a chave do Drive ficam no servidor; o navegador recebe apenas um link temporário do próprio BookSyde.

## Configuração

1. Envie um EPUB/PDF/CBZ de teste ao Google Drive sem apagar o original do Supabase.
2. Para o primeiro teste, configure o arquivo como "Qualquer pessoa com o link".
3. Copie o ID do arquivo da URL do Drive.
4. Descubra o UUID do volume no Supabase (`public.volumes.id`).
5. No ambiente do servidor configure:

```env
BOOKSYDE_DRIVE_FILES={"UUID_DO_VOLUME":"FILE_ID_DO_DRIVE"}
BOOKSYDE_DRIVE_PROXY_SECRET=coloque-um-segredo-grande-e-aleatorio-aqui
GOOGLE_DRIVE_API_KEY=
```

6. Reinicie/republique o projeto e abra o volume normalmente no leitor.

Para voltar 100% ao Supabase basta usar `BOOKSYDE_DRIVE_FILES={}` ou remover a variável. Nenhum dado precisa ser restaurado.

## Limitação deste teste

O Google Drive não é um object storage/CDN e pode aplicar limites de download/tráfego. Esta implementação serve para validar tecnicamente o fluxo sem comprometer o armazenamento atual. Para produção em escala, mantenha um storage próprio (Supabase Storage/R2/S3 equivalente).
