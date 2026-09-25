# Correção Google Drive — publicação e páginas

- Volumes importados do Google Drive passam a ser publicados automaticamente.
- A sincronização abre cada PDF no servidor com PDF.js e grava `page_count` real no Supabase.
- Volumes do Drive já existentes são atualizados ao sincronizar novamente a mesma pasta.
- O PDF continua armazenado no Google Drive; somente metadados ficam no Supabase.
- O leitor agora detecta volumes `gdrive:` antes de procurar um arquivo no bucket `volume-sources`, permitindo leitura pelo proxy assinado.
- Volumes normais já existentes no Supabase continuam preservados e não são substituídos.

Observação: a primeira sincronização pode levar mais tempo porque cada PDF precisa ser lido para descobrir a quantidade real de páginas.
