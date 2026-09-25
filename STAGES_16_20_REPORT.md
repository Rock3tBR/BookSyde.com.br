# BookSyde — Estágios 16 a 20

## 16 — Progresso de leitura
Camada Java única para `reading_progress`, independente da origem do arquivo. Endpoints GET/PUT por volume. Isso elimina a necessidade arquitetural de uma regra separada para Google Drive.

## 17 — Comentários e avaliações
Entities/repositories/services/controllers para `comments` e `reviews`, com ownership para edição/remoção e nota limitada a 1–5.

## 18 — Notificações
Criado `NotificationService` como ponto central de eventos/notificações server-side. O schema atual não possui tabela `notifications`; por isso nenhuma tabela nova foi inventada neste estágio.

## 19 — E-mail
Criado `ResendEmailService`; API key permanece somente no backend. Base de notificação de venda preparada. Confirmação de conta e recuperação de senha continuam sob Supabase Auth enquanto esse é o provedor de autenticação.

## 20 — Google Drive e integrações
Criado `GoogleDriveService` e controller server-side para listagem/download. `GOOGLE_DRIVE_API_KEY` fica somente no backend. Rotas TypeScript antigas foram preservadas como fallback até a integração do frontend ser validada.

## Pendências de validação
- Executar `mvn clean test` em ambiente com Maven/Java 21.
- Executar `npm install && npm run build`.
- Validar Drive real e Resend real com secrets.
- Trocar leitores/componentes gradualmente para `readingProgressApi` antes de remover acesso direto legado ao Supabase.
