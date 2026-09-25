# Teste Google Drive por pasta

1. No Google Drive, compartilhe a pasta como **Qualquer pessoa com o link / Leitor**.
2. Habilite a Google Drive API no Google Cloud e crie uma API Key.
3. Configure `GOOGLE_DRIVE_API_KEY` e `BOOKSYDE_DRIVE_PROXY_SECRET` no ambiente do servidor.
4. No BookSyde: Estúdio > Conteúdo > escolha a obra > **Importar pasta do Google Drive**.
5. Cole o link da pasta uma única vez e clique em **Importar pasta**.

Os PDFs devem ter número no nome, preferencialmente `NOME VOL.01.pdf`, `NOME VOL.02.pdf` etc.

O teste NÃO apaga arquivos do Supabase. Se já existir um volume normal do Supabase com o mesmo número, ele é preservado e ignorado. Volumes já importados do Drive podem ser sincronizados novamente.

Os volumes novos do Drive entram como não publicados (`published=false`) para revisão antes da publicação.
