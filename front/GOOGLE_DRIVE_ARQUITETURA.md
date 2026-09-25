# Google Drive como armazenamento de conteúdo

- PDFs importados permanecem exclusivamente no Google Drive.
- Supabase armazena apenas metadados do volume (`gdrive:FILE_ID`, nome, tamanho, páginas, ordem e permissões).
- O leitor de PDF resolve o arquivo pelo `/api/reader-pages` e renderiza com PDF.js.
- PDFs não usam `public.pages`; essa tabela continua apenas para formatos antigos/baseados em imagens.
- A migração `20260924030000_drive_import_page_processing.sql` remove a RPC experimental que poderia duplicar páginas no Supabase.
