# 🗄️ Caminhos de Referência do Banco de Dados

Este arquivo lista todos os arquivos que fazem referência à API/cliente do banco de dados.
Use-o para localizar rapidamente onde trocar a configuração do banco sem perder funcionalidades.

---

## 📌 Arquivo de Configuração Central (NÃO EDITAR)

| Arquivo | Descrição |
|---------|-----------|
| `src/integrations/supabase/client.ts` | Cliente principal (gerado automaticamente) |
| `src/integrations/supabase/types.ts` | Tipos do banco (gerado automaticamente) |
| `.env` | Variáveis de ambiente (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY) |

> ⚠️ Estes arquivos são gerados automaticamente. Para trocar a API do banco, altere apenas as variáveis de ambiente no `.env`.

---

## 📁 Arquivos do Frontend que importam o cliente

### Contextos e Autenticação
| Arquivo | Uso |
|---------|-----|
| `src/contexts/AuthContext.tsx` | Autenticação, sessão, perfil do usuário |
| `src/pages/Auth.tsx` | Página de login/registro |

### Hooks (Lógica de Dados)
| Arquivo | Uso |
|---------|-----|
| `src/hooks/useAnnouncements.ts` | CRUD de avisos |
| `src/hooks/useAutomationRules.ts` | Regras de automação de tarefas |
| `src/hooks/useBirthdayCelebration.ts` | Aniversariantes |
| `src/hooks/useBoardScores.ts` | Pontuação mensal dos membros do mural |
| `src/hooks/useBoardTasks.ts` | Tarefas dos quadros |
| `src/hooks/useCardDuplications.ts` | Auto-duplicação de cards |
| `src/hooks/useColumnAutoSubtasks.ts` | Subtarefas automáticas por coluna |
| `src/hooks/useData.ts` | Dados gerais (perfis, setores) |
| `src/hooks/useDirectMessages.ts` | Mensagens diretas |
| `src/hooks/useFaceRecognition.ts` | Reconhecimento facial |
| `src/hooks/useFileUpload.ts` | Upload de arquivos |
| `src/hooks/useImportantAnnouncements.ts` | Comunicados importantes |
| `src/hooks/useMeetingStatus.ts` | Status de reuniões no calendário |
| `src/hooks/useMessageReactions.ts` | Reações em mensagens do chat |
| `src/hooks/useNotifications.ts` | Notificações |
| `src/hooks/useOnboarding.ts` | Onboarding de novos usuários |
| `src/hooks/usePresence.ts` | Status de presença online |
| `src/hooks/usePrivateGroups.ts` | Grupos privados |
| `src/hooks/useScheduledSummaries.ts` | Resumos automáticos agendados |
| `src/hooks/useSectorManagement.ts` | Gestão de setores |
| `src/hooks/useSubtaskGroups.ts` | Grupos de subtarefas |
| `src/hooks/useSubtasks.ts` | Subtarefas |
| `src/hooks/useSupervisorTeam.ts` | Equipe do supervisor |
| `src/hooks/useTaskActivities.ts` | Histórico de atividades de tarefas |
| `src/hooks/useTaskAssignees.ts` | Múltiplos responsáveis por tarefa |
| `src/hooks/useTaskBoards.ts` | Quadros de tarefas |
| `src/hooks/useTaskDecisions.ts` | Decisões registradas em tarefas |
| `src/hooks/useTaskLabels.ts` | Etiquetas de tarefas |
| `src/hooks/useTasks.ts` | Tarefas gerais |
| `src/hooks/useTeamAnalytics.ts` | Analytics da equipe |
| `src/hooks/useTypingIndicator.ts` | Indicador de digitação em tempo real |
| `src/hooks/useWarRoomAlarm.ts` | Alarme de sala de guerra |
| `src/hooks/useWarRooms.ts` | Salas de guerra |
| `src/hooks/useWorkflowRules.ts` | Regras de workflow entre colunas |
| `src/hooks/useWorkloadAlerts.ts` | Alertas de sobrecarga de trabalho |

### Componentes (Acesso direto ao banco)
| Arquivo | Uso |
|---------|-----|
| `src/components/chatbot/ChatbotWidget.tsx` | Widget de chatbot |
| `src/components/chat/CardMentionCard.tsx` | Visualização de card mencionado |
| `src/components/chat/CardMentionPicker.tsx` | Menção de cards no chat |
| `src/components/chat/ChatInput.tsx` | Input do chat |
| `src/components/chat/ChatMessage.tsx` | Mensagens do chat |
| `src/components/chat/DirectMessageChat.tsx` | Chat direto |
| `src/components/chat/DirectMessageList.tsx` | Lista de DMs |
| `src/components/chat/PrivateGroupChat.tsx` | Chat de grupos |
| `src/components/chat/PrivateGroupList.tsx` | Lista de grupos |
| `src/components/chat/SectorTabs.tsx` | Abas de setores |
| `src/components/facial/FacialLoginCamera.tsx` | Login por reconhecimento facial |
| `src/components/layout/NotificationPanel.tsx` | Painel de notificações |
| `src/components/management/UserRegistrationDialog.tsx` | Registro de usuários |
| `src/components/sections/AnnouncementsSection.tsx` | Seção de avisos |
| `src/components/sections/CalendarSection.tsx` | Calendário de eventos e reuniões |
| `src/components/sections/ChatSection.tsx` | Seção principal do chat |
| `src/components/sections/DataManagementSection.tsx` | Exclusão de dados |
| `src/components/sections/FacialRegistrationSection.tsx` | Cadastro facial |
| `src/components/sections/FeedbackEmailSection.tsx` | Disparo de feedback |
| `src/components/sections/HomeSection.tsx` | Página inicial |
| `src/components/sections/ImportantAnnouncementsSection.tsx` | Comunicados |
| `src/components/sections/LogsSection.tsx` | Logs do sistema |
| `src/components/sections/ManagementSection.tsx` | Gerenciamento |
| `src/components/sections/PeopleManagementSection.tsx` | Gestão de pessoas |
| `src/components/sections/SectorManagementSection.tsx` | Gestão de setores |
| `src/components/sections/StorageMonitoringSection.tsx` | Monitoramento de armazenamento |
| `src/components/sections/TaskBoardSection.tsx` | Quadro de tarefas |
| `src/components/sections/WarRoomSection.tsx` | Sala de guerra |
| `src/components/sector/SectorUsersList.tsx` | Usuários do setor |
| `src/components/tasks/OperationModePanel.tsx` | Painel de modo operação |
| `src/components/user/PresenceIndicator.tsx` | Indicador de presença |
| `src/components/user/UserPreviewDialog.tsx` | Preview de usuário |
| `src/components/user/UserProfileDialog.tsx` | Perfil do usuário |
| `src/components/user/UserStatusSelector.tsx` | Status do usuário |

---

## 🔧 Edge Functions (Backend)

Cada edge function cria seu próprio cliente usando `Deno.env.get('SUPABASE_URL')` e `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`.

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/create-admin/index.ts` | Criação de admin |
| `supabase/functions/delete-data/index.ts` | Exclusão de dados em massa |
| `supabase/functions/duplicate-scheduled-cards/index.ts` | Duplicação automática de cards agendados |
| `supabase/functions/facial-login/index.ts` | Login por reconhecimento facial |
| `supabase/functions/get-facial-data/index.ts` | Busca de dados faciais |
| `supabase/functions/get-public-sectors/index.ts` | Setores públicos |
| `supabase/functions/process-automations/index.ts` | Processamento de regras de automação |
| `supabase/functions/register-facial-data/index.ts` | Registro facial |
| `supabase/functions/register-user/index.ts` | Registro de usuário |
| `supabase/functions/send-announcement-email/index.ts` | E-mail de avisos |
| `supabase/functions/send-feedback-email/index.ts` | E-mail + DM de feedback |
| `supabase/functions/send-scheduled-summary/index.ts` | Envio de resumos automáticos da equipe |
| `supabase/functions/update-user-permissions/index.ts` | Permissões de usuário |

---

## 🔄 Como trocar a API do banco

1. **Frontend**: Altere apenas as variáveis no `.env`:
   - `VITE_SUPABASE_URL` → URL do novo banco
   - `VITE_SUPABASE_PUBLISHABLE_KEY` → Chave pública do novo banco

2. **Edge Functions**: As variáveis são gerenciadas automaticamente pelo Lovable Cloud:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` 
   - `SUPABASE_SERVICE_ROLE_KEY`

3. **Todos os imports apontam para** `@/integrations/supabase/client` — não há imports diretos em outros lugares do frontend.

> ⚠️ **ATENÇÃO**: Trocar o banco requer que o novo banco tenha o mesmo schema (tabelas, colunas, funções, policies). Caso contrário, funcionalidades serão perdidas.
