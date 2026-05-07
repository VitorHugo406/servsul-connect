# Diagnóstico e plano de migração do banco externo

## 1. Resumo simples

Hoje o projeto usa **Lovable Cloud** como backend. Na prática, o app conversa com um backend compatível com **Supabase**, que por baixo usa **PostgreSQL** para o banco, além de autenticação, storage de arquivos, realtime e funções de backend.

O projeto **não usa Firebase** e **não usa SQLite**. O banco de dados principal é **PostgreSQL**, acessado pelo cliente `@supabase/supabase-js`.

> Ponto importante: um app React no navegador **não deve conectar diretamente em um PostgreSQL da empresa**, porque isso exporia usuário, senha e permissões do banco para qualquer pessoa. Para migrar com segurança, o banco externo precisa estar atrás de uma camada compatível com Supabase/PostgREST/Auth/Storage ou de uma API própria.

## 2. O que foi encontrado no diagnóstico

- **Banco atual:** PostgreSQL gerenciado pelo Lovable Cloud.
- **Cliente usado no frontend:** `@supabase/supabase-js`.
- **Arquivo central da conexão:** `src/integrations/supabase/client.ts`.
- **Variáveis lidas pelo frontend:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Configuração de funções:** `supabase/config.toml`.
- **Tabelas públicas encontradas:** 65.
- **Funções SQL públicas encontradas:** 23.
- **Políticas de segurança RLS encontradas:** 219.
- **Funções de backend encontradas:** 15.
- **Arquivos do frontend que importam o cliente do backend:** 73.

## 3. Onde estão as configurações do banco

### `src/integrations/supabase/client.ts`

Este arquivo cria o cliente usado pelo app inteiro:

```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

**Não edite esse arquivo dentro do Lovable**, porque ele é gerado automaticamente. Em um ambiente externo, o caminho correto é alterar as variáveis de ambiente do deploy.

### `supabase/config.toml`

Define quais funções de backend existem e se exigem token JWT. Exemplos:

- `facial-login`
- `register-user`
- `delete-data`
- `send-feedback-email`
- `process-automations`
- `servchat-conference`

### `.env.external.example`

Criei um exemplo para ambiente externo:

```env
VITE_SUPABASE_URL=https://seu-backend-externo.exemplo.com
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica_anon
TARGET_DATABASE_URL=postgresql://usuario:senha@host:5432/banco
```

No Lovable, o `.env` interno é gerenciado automaticamente. Fora do Lovable, use `.env.local`, variáveis do Vercel, Docker, CI/CD ou painel de hospedagem.

## 4. Arquivos que controlam conexão com banco

### Arquivo principal

- `src/integrations/supabase/client.ts`

### Contexto de autenticação

- `src/contexts/AuthContext.tsx`

Esse arquivo controla sessão, usuário logado, perfil, setor, permissões e roles.

### Página de login/cadastro

- `src/pages/Auth.tsx`

Usa autenticação por e-mail/senha, chamadas a funções de backend e login facial.

### Uploads e storage

- `src/hooks/useFileUpload.ts`

Usa buckets de arquivos para:

- `attachments` — anexos do chat/avisos/cards.
- `avatars` — fotos de perfil.
- `face-images` — imagens/dados faciais privados.

## 5. Existe dependência do Lovable Cloud além do banco?

Sim. Não é só banco.

O projeto depende de:

1. **Banco PostgreSQL** — tabelas, funções SQL, políticas RLS, realtime.
2. **Autenticação** — login, sessão, tokens, usuários, `auth.uid()` nas policies.
3. **Storage** — anexos, avatares e arquivos faciais.
4. **Funções de backend** — cadastro de usuário, login facial, automações, e-mails, integrações.
5. **Realtime** — chat, presença, notas, tarefas e atualizações ao vivo.
6. **Secrets** — chaves internas usadas por funções como Resend, API de conferência e service role.

Se migrar apenas as tabelas para um PostgreSQL comum, muita coisa vai quebrar: login, RLS, upload, funções e realtime.

## 6. Como autenticação, usuários, uploads e storage funcionam

### Autenticação

- O app usa `supabase.auth`.
- A sessão fica no navegador com `localStorage`.
- O usuário autenticado é identificado por `auth.uid()` nas regras do banco.
- A tabela `profiles` guarda dados públicos do usuário.
- A tabela `user_roles` guarda roles/admin, separada de `profiles` por segurança.
- A tabela `user_permissions` guarda permissões finas.

### Usuários

Fluxo simplificado:

1. Usuário faz login.
2. O app recebe uma sessão.
3. `AuthContext.tsx` busca `profiles` usando `user_id`.
4. Busca também `user_roles`, `user_permissions`, setores e permissões extras.
5. Se `is_active = false`, o usuário é bloqueado.

### Uploads

O hook `useFileUpload.ts` envia arquivos para storage e salva metadados em tabelas como `attachments`.

Regras importantes:

- Limite de 2MB por arquivo.
- Buckets atuais: `attachments`, `avatars`, `face-images`.
- `attachments` e `avatars` são públicos.
- `face-images` é privado.

### Storage

Storage não é só uma pasta de arquivos. Ele também tem metadados e permissões. Em uma migração, você precisa copiar:

1. Arquivos físicos.
2. Metadados do storage.
3. URLs ou caminhos salvos no banco.
4. Políticas de acesso.

## 7. O que precisa ser migrado

Para o sistema continuar funcionando normalmente, migre:

- Todas as tabelas públicas.
- Todos os dados das tabelas públicas.
- Schema de autenticação, se usar backend compatível com Supabase.
- Usuários e senhas/tokens de autenticação.
- Storage buckets e arquivos físicos.
- Metadados de storage.
- Políticas RLS.
- Funções SQL.
- Triggers.
- Realtime/publications.
- Funções de backend em `supabase/functions`.
- Secrets das funções.
- Variáveis de ambiente do frontend.

## 8. Plano completo de migração

### Fase 1 — Congelar mudanças

1. Avise os usuários sobre uma janela de manutenção.
2. Pare novas alterações durante a exportação.
3. Faça backup completo antes de qualquer troca.

### Fase 2 — Preparar o destino

Escolha um dos caminhos:

#### Opção A — Recomendada: backend externo compatível com Supabase

Use uma stack que ofereça PostgreSQL + Auth + Storage + Realtime + Functions compatíveis. Assim o app muda quase nada: principalmente as variáveis de ambiente.

#### Opção B — PostgreSQL puro da empresa

Vai exigir criar uma API própria para substituir:

- `supabase.from(...)`
- `supabase.auth...`
- `supabase.storage...`
- `supabase.functions.invoke(...)`
- realtime channels

Essa opção é maior e mais arriscada.

### Fase 3 — Exportar dados

Use o script criado:

```bash
./scripts/migration/export_lovable_cloud.sh ./database-export
```

Ele gera:

- `01_schema.sql`
- `02_public_data.sql`
- `03_auth_data.sql`
- `04_storage_metadata.sql`

### Fase 4 — Migrar arquivos de storage

Copie os arquivos dos buckets:

- `attachments`
- `avatars`
- `face-images`

Atenção: o script SQL exporta metadados, mas os binários dos arquivos precisam ser copiados via ferramenta/API de storage.

### Fase 5 — Importar no novo PostgreSQL

Use:

```bash
./scripts/migration/import_to_postgres.sh ./database-export 'postgresql://usuario:senha@host:5432/banco'
```

Ou:

```bash
export TARGET_DATABASE_URL='postgresql://usuario:senha@host:5432/banco'
./scripts/migration/import_to_postgres.sh ./database-export
```

### Fase 6 — Configurar variáveis no app externo

Exemplo:

```env
VITE_SUPABASE_URL=https://novo-backend-da-empresa.com
VITE_SUPABASE_PUBLISHABLE_KEY=chave_publica_anon_do_novo_backend
```

Para funções/backend, configure também as chaves secretas equivalentes no ambiente do servidor:

```env
SUPABASE_URL=https://novo-backend-da-empresa.com
SUPABASE_ANON_KEY=chave_anon
SUPABASE_SERVICE_ROLE_KEY=chave_service_role
RESEND_API_KEY=sua_chave_resend
SERVCHAT_CONFERENCE_API_KEY=sua_chave_conferencia
```

Nunca coloque `SERVICE_ROLE_KEY` no frontend.

### Fase 7 — Validar antes de virar produção

Rode:

```bash
psql 'postgresql://usuario:senha@host:5432/banco' -f scripts/migration/validate_postgres_migration.sql
```

Compare contagens com o banco antigo.

### Fase 8 — Virada final

1. Faça exportação final após congelar o sistema.
2. Importe no destino.
3. Valide login, notas, chat, tarefas, anexos e War Room.
4. Só então aponte o app para o backend novo.

## 9. Arquivos que precisam ser alterados ou configurados

### Se o destino for compatível com Supabase

Normalmente você altera só ambiente/deploy:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- secrets das funções de backend

Arquivos de referência:

- `src/integrations/supabase/client.ts` — referência da conexão, não editar no Lovable.
- `supabase/config.toml` — lista funções.
- `supabase/functions/**/index.ts` — funções backend.

### Se o destino for PostgreSQL puro

Será necessário reescrever muitas partes:

- `src/integrations/supabase/client.ts` ou criar uma camada nova de API.
- `src/contexts/AuthContext.tsx`
- `src/pages/Auth.tsx`
- `src/hooks/useFileUpload.ts`
- Todos os hooks/componentes que usam `supabase.from(...)`.
- Todas as chamadas `supabase.functions.invoke(...)`.
- Todas as chamadas realtime `.channel(...)`.

## 10. Lista de funções backend encontradas

- `supabase/functions/api-integrations/index.ts`
- `supabase/functions/create-admin/index.ts`
- `supabase/functions/delete-data/index.ts`
- `supabase/functions/duplicate-scheduled-cards/index.ts`
- `supabase/functions/facial-login/index.ts`
- `supabase/functions/get-facial-data/index.ts`
- `supabase/functions/get-public-sectors/index.ts`
- `supabase/functions/process-automations/index.ts`
- `supabase/functions/register-facial-data/index.ts`
- `supabase/functions/register-user/index.ts`
- `supabase/functions/send-announcement-email/index.ts`
- `supabase/functions/send-feedback-email/index.ts`
- `supabase/functions/send-scheduled-summary/index.ts`
- `supabase/functions/servchat-conference/index.ts`
- `supabase/functions/update-user-permissions/index.ts`

## 11. Lista de tabelas públicas encontradas

- `announcement_comments`
- `announcement_reads`
- `announcements`
- `api_access_logs`
- `api_integration_history`
- `api_integrations`
- `attachments`
- `audit_logs`
- `board_join_requests`
- `board_share_links`
- `calendar_events`
- `column_auto_subtasks`
- `column_workflow_rules`
- `direct_messages`
- `eval_competencies`
- `eval_cycles`
- `eval_position_competencies`
- `eval_positions`
- `evaluation_history`
- `evaluation_items`
- `evaluations`
- `important_announcement_reads`
- `important_announcements`
- `meeting_participants`
- `message_reactions`
- `messages`
- `monthly_scores`
- `note_shares`
- `notes`
- `private_group_members`
- `private_group_message_reads`
- `private_group_messages`
- `private_groups`
- `profiles`
- `scheduled_summaries`
- `sectors`
- `subtask_groups`
- `supervisor_team_members`
- `system_settings`
- `task_activities`
- `task_assignees`
- `task_auto_duplications`
- `task_automation_rules`
- `task_board_columns`
- `task_board_members`
- `task_boards`
- `task_comments`
- `task_decisions`
- `task_label_assignments`
- `task_labels`
- `task_subtasks`
- `tasks`
- `team_members`
- `teams`
- `user_additional_sectors`
- `user_facial_data`
- `user_notifications`
- `user_permissions`
- `user_presence`
- `user_roles`
- `war_room_members`
- `war_room_messages`
- `war_room_timeline`
- `war_rooms`
- `workload_alerts`

## 12. Arquivos do frontend que importam o cliente atual

- `src/components/chat/CardMentionCard.tsx`
- `src/components/chat/CardMentionPicker.tsx`
- `src/components/chat/ChatMediaFilter.tsx`
- `src/components/chat/PrivateGroupChat.tsx`
- `src/components/chatbot/ChatbotWidget.tsx`
- `src/components/facial/FacialLoginCamera.tsx`
- `src/components/layout/NotificationPanel.tsx`
- `src/components/management/UserRegistrationDialog.tsx`
- `src/components/notes/NoteMentionPicker.tsx`
- `src/components/notes/NoteShareDialog.tsx`
- `src/components/sections/ApiManagementSection.tsx`
- `src/components/sections/CalendarSection.tsx`
- `src/components/sections/ChatSection.tsx`
- `src/components/sections/DataManagementSection.tsx`
- `src/components/sections/EvaluationsSection.tsx`
- `src/components/sections/FacialRegistrationSection.tsx`
- `src/components/sections/FeedbackEmailSection.tsx`
- `src/components/sections/HomeSection.tsx`
- `src/components/sections/ImportantAnnouncementsSection.tsx`
- `src/components/sections/LogsSection.tsx`
- `src/components/sections/ManagementSection.tsx`
- `src/components/sections/MyDashboardSection.tsx`
- `src/components/sections/PeopleManagementSection.tsx`
- `src/components/sections/StorageMonitoringSection.tsx`
- `src/components/sections/TaskBoardSection.tsx`
- `src/components/sections/WarRoomSection.tsx`
- `src/components/sector/SectorUsersList.tsx`
- `src/components/tasks/BoardJoinDialog.tsx`
- `src/components/tasks/OperationModePanel.tsx`
- `src/components/teams/TeamManager.tsx`
- `src/components/user/UserPreviewDialog.tsx`
- `src/components/user/UserProfileDialog.tsx`
- `src/components/user/UserStatusSelector.tsx`
- `src/components/warroom/WarRoomTaskDialog.tsx`
- `src/contexts/AuthContext.tsx`
- `src/hooks/useAnnouncements.ts`
- `src/hooks/useAutomationRules.ts`
- `src/hooks/useBoardScores.ts`
- `src/hooks/useBoardTasks.ts`
- `src/hooks/useCardDuplications.ts`
- `src/hooks/useColumnAutoSubtasks.ts`
- `src/hooks/useData.ts`
- `src/hooks/useDirectMessages.ts`
- `src/hooks/useEvaluations.ts`
- `src/hooks/useFileUpload.ts`
- `src/hooks/useImportantAnnouncements.ts`
- `src/hooks/useMeetingStatus.ts`
- `src/hooks/useMessageReactions.ts`
- `src/hooks/useNotes.ts`
- `src/hooks/useNotifications.ts`
- `src/hooks/useOnboarding.ts`
- `src/hooks/usePresence.ts`
- `src/hooks/usePrivateGroups.ts`
- `src/hooks/useScheduledSummaries.ts`
- `src/hooks/useSectorManagement.ts`
- `src/hooks/useSubtaskGroups.ts`
- `src/hooks/useSubtasks.ts`
- `src/hooks/useSupervisorTeam.ts`
- `src/hooks/useTaskActivities.ts`
- `src/hooks/useTaskAssignees.ts`
- `src/hooks/useTaskBoards.ts`
- `src/hooks/useTaskDecisions.ts`
- `src/hooks/useTaskLabels.ts`
- `src/hooks/useTasks.ts`
- `src/hooks/useTeamAnalytics.ts`
- `src/hooks/useTeams.ts`
- `src/hooks/useTypingIndicator.ts`
- `src/hooks/useWarRoomAlarm.ts`
- `src/hooks/useWarRooms.ts`
- `src/hooks/useWorkflowRules.ts`
- `src/hooks/useWorkloadAlerts.ts`
- `src/integrations/supabase/client.ts`
- `src/pages/Auth.tsx`

## 13. Riscos da migração

- **Perder login** se usuários de autenticação não forem migrados corretamente.
- **Quebrar permissões** se RLS, roles ou funções SQL não forem migradas.
- **Arquivos sumirem** se copiar tabelas mas não copiar storage físico.
- **URLs antigas de anexos/avatar** podem apontar para o storage antigo.
- **Realtime parar** se o destino não suportar canais em tempo real.
- **Funções pararem** se secrets não forem configuradas.
- **Login facial quebrar** se `face-images` e funções faciais não forem migradas.
- **E-mails pararem** se `RESEND_API_KEY` não estiver no novo ambiente.
- **Automação de tarefas parar** se funções agendadas não forem configuradas.

## 14. Checklist de validação após migração

### Dados

- [ ] Quantidade de usuários em `profiles` confere.
- [ ] Quantidade de roles em `user_roles` confere.
- [ ] Quantidade de notas em `notes` confere.
- [ ] Quantidade de tarefas em `tasks` confere.
- [ ] Quantidade de mensagens em `messages` confere.
- [ ] Quantidade de anexos em `attachments` confere.
- [ ] Quantidade de objetos em storage confere.

### Login e permissões

- [ ] Login com usuário comum funciona.
- [ ] Login com admin funciona.
- [ ] Usuário inativo continua bloqueado.
- [ ] Admin vê área de gestão.
- [ ] Usuário comum não vê área restrita.

### Funcionalidades principais

- [ ] Criar anotação.
- [ ] Editar anotação.
- [ ] Sair e voltar: anotação permanece salva.
- [ ] Compartilhamento somente leitura não permite editar.
- [ ] Chat geral funciona.
- [ ] Mensagem direta funciona.
- [ ] Upload de anexo funciona.
- [ ] Avatar carrega.
- [ ] Tarefas e cards abrem.
- [ ] Menções de pessoa, reunião e card abrem o destino certo.
- [ ] War Room cria sala e notifica corretamente.
- [ ] Painel de notificações marca como lido.

### Backend

- [ ] Função `register-user` funciona.
- [ ] Função `facial-login` funciona.
- [ ] Função `delete-data` funciona apenas para admin.
- [ ] Funções de e-mail funcionam.
- [ ] Automação de cards funciona.

## 15. Recomendação final

Para não perder dados e não quebrar login, **não migre para PostgreSQL puro diretamente**. O caminho seguro é migrar para um backend externo compatível com Supabase, porque o app atual usa banco, auth, storage, realtime e funções como um conjunto integrado.

Se a empresa exige PostgreSQL próprio, recomendo fazer em duas etapas:

1. Primeiro migrar para um ambiente compatível, mantendo o app funcionando.
2. Depois, se necessário, criar uma API corporativa e substituir aos poucos o uso direto do cliente Supabase.
