import { useState, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, ChevronDown, ChevronRight, BookOpen, Database, Code2, Layers, Shield, Zap, Users, MessageSquare, Bell, ListTodo, CalendarDays, FileText, HardDrive, Building2, Sparkles, Mail, Cake, Home, Settings, Trash2, Eye, Lock, Server, Globe, Smartphone } from 'lucide-react';
import logoServsul from '@/assets/logo-servsul.png';
import appLogo from '@/assets/app-logo.png';
import { cn } from '@/lib/utils';

interface DocSection {
  id: string;
  title: string;
  icon: any;
  content: React.ReactNode;
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <Icon className="h-5 w-5 text-primary shrink-0" />
        <span className="font-semibold text-sm">{title}</span>
      </button>
      {open && <div className="p-4 border-t border-border space-y-3 text-sm leading-relaxed">{children}</div>}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-muted/50 border border-border rounded-md px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}

function TableRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex border-b border-border last:border-0">
      <div className="w-1/3 px-3 py-2 bg-muted/20 font-medium text-xs">{label}</div>
      <div className="w-2/3 px-3 py-2 text-xs">{value}</div>
    </div>
  );
}

export function DocumentationSection() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const toc = [
    { id: 'overview', label: '1. Visão Geral do Sistema' },
    { id: 'tech-stack', label: '2. Stack Tecnológica' },
    { id: 'database', label: '3. Banco de Dados' },
    { id: 'auth', label: '4. Autenticação e Segurança' },
    { id: 'features', label: '5. Funcionalidades' },
    { id: 'file-structure', label: '6. Estrutura de Arquivos' },
    { id: 'hooks', label: '7. Hooks Customizados' },
    { id: 'edge-functions', label: '8. Funções de Backend' },
    { id: 'storage', label: '9. Armazenamento de Arquivos' },
    { id: 'pwa', label: '10. PWA e Responsividade' },
    { id: 'rls', label: '11. Políticas de Segurança (RLS)' },
    { id: 'realtime', label: '12. Funcionalidades em Tempo Real' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header with print button */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border print:hidden">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold">Documentação Técnica</h1>
            <p className="text-xs text-muted-foreground">ServChat — Grupo Servsul</p>
          </div>
        </div>
        <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
          <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div ref={printRef} className="max-w-4xl mx-auto px-6 py-8 space-y-8 print:max-w-none print:px-8">

          {/* Cover */}
          <div className="text-center space-y-4 pb-6 border-b border-border">
            <div className="flex items-center justify-center gap-4">
              <img src={logoServsul} alt="Grupo Servsul" className="h-16 w-16 object-contain rounded-xl" />
              <img src={appLogo} alt="ServChat" className="h-16 w-16 object-contain rounded-xl" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">ServChat</h1>
            <p className="text-muted-foreground text-sm">Plataforma de Comunicação Interna — Grupo Servsul</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Badge variant="secondary">React 18</Badge>
              <Badge variant="secondary">TypeScript</Badge>
              <Badge variant="secondary">Tailwind CSS</Badge>
              <Badge variant="secondary">Supabase</Badge>
              <Badge variant="secondary">Vite</Badge>
              <Badge variant="secondary">PWA</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Documentação gerada automaticamente • Versão atual do sistema</p>
          </div>

          {/* Table of Contents */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Índice</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {toc.map(item => (
                  <a key={item.id} href={`#doc-${item.id}`} className="text-sm text-primary hover:underline py-0.5">{item.label}</a>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 1. Visão Geral */}
          <div id="doc-overview" className="scroll-mt-4">
            <CollapsibleSection title="1. Visão Geral do Sistema" icon={Globe} defaultOpen>
              <p>
                O <strong>ServChat</strong> é uma plataforma web interna desenvolvida para o <strong>Grupo Servsul</strong>, focada em comunicação corporativa, gestão de tarefas e colaboração entre setores. O sistema foi projetado para centralizar toda a comunicação interna, substituindo ferramentas fragmentadas.
              </p>
              <h4 className="font-semibold mt-3">Principais Objetivos:</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Centralizar a comunicação interna entre setores da empresa</li>
                <li>Gerenciar tarefas com quadros estilo Kanban</li>
                <li>Publicar avisos e comunicados oficiais com controle de leitura</li>
                <li>Mural de aniversariantes e eventos sazonais</li>
                <li>Controle de acesso por níveis de autonomia (admin, gerente, gestor, diretoria, supervisor, colaborador)</li>
                <li>Reconhecimento facial para autenticação biométrica</li>
                <li>Calendário integrado com reuniões e lembretes</li>
                <li>Disparo de e-mails de feedback via integração com Resend API</li>
              </ul>
            </CollapsibleSection>
          </div>

          {/* 2. Stack Tecnológica */}
          <div id="doc-tech-stack" className="scroll-mt-4">
            <CollapsibleSection title="2. Stack Tecnológica" icon={Code2} defaultOpen>
              <h4 className="font-semibold">Frontend:</h4>
              <div className="border border-border rounded-md overflow-hidden mb-3">
                <TableRow label="Linguagem" value="TypeScript (tipagem estática sobre JavaScript)" />
                <TableRow label="Framework" value="React 18.3 (biblioteca de interfaces declarativas)" />
                <TableRow label="Build Tool" value="Vite (bundler rápido com HMR)" />
                <TableRow label="Estilização" value="Tailwind CSS 4 com design tokens semânticos (HSL)" />
                <TableRow label="Componentes UI" value="shadcn/ui (Radix UI primitives + Tailwind)" />
                <TableRow label="Animações" value="Framer Motion (transições e animações declarativas)" />
                <TableRow label="Roteamento" value="React Router DOM v6 (navegação SPA)" />
                <TableRow label="Formulários" value="React Hook Form + Zod (validação de schemas)" />
                <TableRow label="Gráficos" value="Recharts (gráficos baseados em SVG)" />
                <TableRow label="Ícones" value="Lucide React (ícones SVG tree-shakable)" />
                <TableRow label="PDF" value="jsPDF + jspdf-autotable (geração de relatórios)" />
                <TableRow label="Excel" value="xlsx (leitura/escrita de planilhas)" />
                <TableRow label="PWA" value="Service Worker customizado com cache offline" />
              </div>

              <h4 className="font-semibold">Backend (Lovable Cloud):</h4>
              <div className="border border-border rounded-md overflow-hidden mb-3">
                <TableRow label="Banco de Dados" value="PostgreSQL (via Supabase — hospedagem gerenciada)" />
                <TableRow label="Autenticação" value="Supabase Auth (JWT, email/senha, reconhecimento facial)" />
                <TableRow label="API REST" value="PostgREST auto-gerado pelo Supabase" />
                <TableRow label="Realtime" value="Supabase Realtime (WebSockets para sync)" />
                <TableRow label="Edge Functions" value="Deno runtime (funções serverless)" />
                <TableRow label="Storage" value="Supabase Storage (buckets para avatars, anexos, face-images)" />
                <TableRow label="E-mail" value="Resend API (disparo de e-mails transacionais)" />
                <TableRow label="Segurança" value="Row Level Security (RLS) em todas as tabelas" />
              </div>
            </CollapsibleSection>
          </div>

          {/* 3. Banco de Dados */}
          <div id="doc-database" className="scroll-mt-4">
            <CollapsibleSection title="3. Banco de Dados (PostgreSQL)" icon={Database}>
              <p>O banco de dados PostgreSQL contém <strong>35+ tabelas</strong> organizadas por domínio funcional. Todas possuem Row Level Security (RLS) ativado.</p>

              <h4 className="font-semibold mt-3">Tabelas Principais por Domínio:</h4>
              
              <h5 className="font-medium mt-2 text-primary">Comunicação:</h5>
              <div className="border border-border rounded-md overflow-hidden mb-2">
                <TableRow label="messages" value="Mensagens do chat por setor. Campos: id, author_id, sector_id, content, created_at" />
                <TableRow label="direct_messages" value="Mensagens diretas entre usuários. Campos: sender_id, receiver_id, content, is_read" />
                <TableRow label="private_groups" value="Grupos privados de chat. Campos: name, description, avatar_url, created_by" />
                <TableRow label="private_group_messages" value="Mensagens dentro dos grupos privados" />
                <TableRow label="private_group_members" value="Membros de cada grupo privado com roles (admin/member)" />
                <TableRow label="private_group_message_reads" value="Controle de última leitura por grupo" />
              </div>

              <h5 className="font-medium mt-2 text-primary">Avisos e Comunicados:</h5>
              <div className="border border-border rounded-md overflow-hidden mb-2">
                <TableRow label="announcements" value="Avisos gerais com prioridade, pin e expiração. Campos: title, content, priority, is_pinned, expire_at" />
                <TableRow label="announcement_comments" value="Comentários nos avisos" />
                <TableRow label="announcement_reads" value="Registro de leitura por usuário" />
                <TableRow label="important_announcements" value="Comunicados importantes com modal obrigatório e border_style customizável" />
                <TableRow label="important_announcement_reads" value="Controle de leitura dos comunicados importantes" />
              </div>

              <h5 className="font-medium mt-2 text-primary">Gestão de Tarefas (Kanban):</h5>
              <div className="border border-border rounded-md overflow-hidden mb-2">
                <TableRow label="task_boards" value="Quadros Kanban. Campos: name, description, owner_id, background_image, overload_threshold" />
                <TableRow label="task_board_columns" value="Colunas do quadro com automações: auto_assign_to, auto_cover, is_conclusion, is_template_column" />
                <TableRow label="task_board_members" value="Membros do quadro com roles (owner, admin, member)" />
                <TableRow label="tasks" value="Cards/tarefas. Campos: title, description, status, priority, assigned_to, due_date, position, is_archived, is_template, cover_image, completed_at, delay_days" />
                <TableRow label="task_subtasks" value="Subtarefas de cada card com grupo opcional" />
                <TableRow label="subtask_groups" value="Grupos de subtarefas dentro de um card" />
                <TableRow label="task_comments" value="Comentários dentro dos cards" />
                <TableRow label="task_activities" value="Histórico de atividades (movimentação, edição, etc.)" />
                <TableRow label="task_labels" value="Etiquetas coloridas por quadro" />
                <TableRow label="task_label_assignments" value="Associação etiqueta ↔ task" />
                <TableRow label="task_assignees" value="Múltiplos responsáveis por task" />
                <TableRow label="task_auto_duplications" value="Regras de duplicação automática (diária, semanal, mensal)" />
                <TableRow label="task_automation_rules" value="Motor de automações SE→ENTÃO (trigger + action)" />
                <TableRow label="column_auto_subtasks" value="Subtarefas automáticas por coluna" />
                <TableRow label="column_workflow_rules" value="Regras de fluxo entre colunas (bloqueios)" />
                <TableRow label="board_share_links" value="Links de compartilhamento de quadros" />
                <TableRow label="board_join_requests" value="Solicitações de entrada em quadros" />
                <TableRow label="workload_alerts" value="Alertas de sobrecarga de trabalho" />
              </div>

              <h5 className="font-medium mt-2 text-primary">Usuários e Permissões:</h5>
              <div className="border border-border rounded-md overflow-hidden mb-2">
                <TableRow label="profiles" value="Perfis de usuário. Campos: name, display_name, email, avatar_url, birth_date, sector_id, autonomy_level, profile_type, is_active" />
                <TableRow label="user_roles" value="Roles do sistema (enum: admin, gerente, supervisor, colaborador, gestor, diretoria)" />
                <TableRow label="user_permissions" value="Permissões granulares: can_post_announcements, can_delete_messages, can_access_management, can_access_password_change" />
                <TableRow label="user_additional_sectors" value="Setores adicionais vinculados ao usuário" />
                <TableRow label="user_presence" value="Status online/offline com heartbeat" />
                <TableRow label="user_notifications" value="Notificações do sistema (menções, avisos, etc.)" />
                <TableRow label="user_facial_data" value="Dados biométricos para reconhecimento facial (descriptors + image)" />
                <TableRow label="supervisor_team_members" value="Vinculação supervisor ↔ membros da equipe" />
              </div>

              <h5 className="font-medium mt-2 text-primary">Outros:</h5>
              <div className="border border-border rounded-md overflow-hidden mb-2">
                <TableRow label="sectors" value="Setores/departamentos da empresa com cor e ícone" />
                <TableRow label="calendar_events" value="Eventos do calendário (reuniões, lembretes)" />
                <TableRow label="meeting_participants" value="Participantes de reuniões com status (pendente, aceito, recusado)" />
                <TableRow label="attachments" value="Anexos de mensagens, DMs e avisos" />
                <TableRow label="audit_logs" value="Logs de auditoria de todas as exclusões" />
                <TableRow label="system_settings" value="Configurações do sistema (ex: weekly_file_limit)" />
              </div>
            </CollapsibleSection>
          </div>

          {/* 4. Autenticação */}
          <div id="doc-auth" className="scroll-mt-4">
            <CollapsibleSection title="4. Autenticação e Segurança" icon={Shield}>
              <h4 className="font-semibold">Métodos de Autenticação:</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>E-mail e Senha:</strong> Cadastro via formulário com verificação de e-mail obrigatória</li>
                <li><strong>Reconhecimento Facial:</strong> Login biométrico usando face-api.js (descriptors armazenados no banco, comparados via Edge Function)</li>
              </ul>

              <h4 className="font-semibold mt-3">Níveis de Autonomia (Enum app_role):</h4>
              <div className="border border-border rounded-md overflow-hidden mb-2">
                <TableRow label="admin" value="Acesso total ao sistema, gerenciamento de usuários e configurações" />
                <TableRow label="gerente" value="Acesso à gestão, avisos e quadros de tarefas" />
                <TableRow label="gestor" value="Acesso similar ao gerente com foco em gestão" />
                <TableRow label="diretoria" value="Acesso a relatórios e gerenciamento" />
                <TableRow label="supervisor" value="Gestão de equipe e visibilidade de tarefas" />
                <TableRow label="colaborador" value="Acesso básico: chat, avisos, tarefas atribuídas" />
              </div>

              <h4 className="font-semibold mt-3">Admin Principal:</h4>
              <p>O administrador principal é identificado pelo e-mail <code className="bg-muted px-1.5 py-0.5 rounded text-xs">adminservchat@servsul.com.br</code> e possui acesso exclusivo a funcionalidades como Logs do Sistema, Armazenamento e esta Documentação.</p>

              <h4 className="font-semibold mt-3">Controle de Acesso no Frontend:</h4>
              <CodeBlock>{`// AuthContext.tsx fornece:
const { user, profile, isAdmin, canAccess, signOut } = useAuth();

// Verificação de permissão:
canAccess('can_access_management') // boolean
isAdmin // verifica role 'admin' na tabela user_roles`}</CodeBlock>
            </CollapsibleSection>
          </div>

          {/* 5. Funcionalidades */}
          <div id="doc-features" className="scroll-mt-4">
            <CollapsibleSection title="5. Funcionalidades do Sistema" icon={Layers}>
              <div className="space-y-4">
                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><Home className="h-4 w-4" /> Início (HomeSection)</h5>
                  <p className="text-muted-foreground">Dashboard principal com cards de resumo: tarefas do dia, aniversariantes, avisos recentes, atividade recente nos quadros. Links rápidos para todas as seções.</p>
                </div>

                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Chat por Setores (ChatSection)</h5>
                  <p className="text-muted-foreground">Chat em tempo real segmentado por setores. Suporta menções de usuários (@nome) e menções de cards de tarefas. Formatação de texto (negrito, itálico). Abas para setores do usuário. Mensagens diretas (DM) e grupos privados com controle de membros.</p>
                </div>

                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><Bell className="h-4 w-4" /> Avisos Gerais (AnnouncementsSection)</h5>
                  <p className="text-muted-foreground">Publicação de avisos com prioridade (baixa, normal, alta, urgente). Suporte a expiração e agendamento. Comentários por aviso. Controle de leitura por usuário. Anexos (PDF, DOC, imagens).</p>
                </div>

                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><Cake className="h-4 w-4" /> Aniversariantes (BirthdaysSection)</h5>
                  <p className="text-muted-foreground">Mural de aniversariantes do mês com celebração animada (confetti). Modal especial no dia do aniversário do usuário logado.</p>
                </div>

                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><ListTodo className="h-4 w-4" /> Gestão de Tarefas (TaskBoardSection)</h5>
                  <p className="text-muted-foreground">
                    Sistema completo de quadros Kanban com:
                  </p>
                  <ul className="list-disc pl-5 text-muted-foreground space-y-0.5 mt-1">
                    <li>Múltiplos quadros com background customizável</li>
                    <li>Colunas configuráveis com cores e automações</li>
                    <li>Cards com título, descrição, prioridade, responsável, data limite, capa</li>
                    <li>Subtarefas com grupos hierárquicos</li>
                    <li>Etiquetas coloridas personalizáveis</li>
                    <li>Múltiplos responsáveis por card</li>
                    <li>Drag-and-drop entre colunas</li>
                    <li>Motor de automações (SE → ENTÃO) com card splitting</li>
                    <li>Duplicação automática de cards (diária, semanal, mensal)</li>
                    <li>Colunas de template e colunas de conclusão</li>
                    <li>Auto-subtarefas por coluna (aplicadas ao criar/mover cards)</li>
                    <li>Regras de workflow (bloqueio de movimentação entre colunas)</li>
                    <li>Compartilhamento via link com solicitação de entrada</li>
                    <li>Relatórios e histórico de atividades</li>
                    <li>Alertas de sobrecarga de trabalho</li>
                    <li>Arquivamento de cards individuais ou por coluna</li>
                  </ul>
                </div>

                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Gestão de Pessoas (PeopleManagementSection)</h5>
                  <p className="text-muted-foreground">Visão geral da equipe para supervisores. Analytics de produtividade. Vinculação de membros à equipe do supervisor.</p>
                </div>

                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><Settings className="h-4 w-4" /> Gerenciamento (ManagementSection)</h5>
                  <p className="text-muted-foreground">Cadastro e edição de usuários. Atribuição de roles e permissões. Ativação/desativação de contas. Cadastro facial biométrico. Alteração de setores e dados do perfil.</p>
                </div>

                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Gestão de Setores (SectorManagementSection)</h5>
                  <p className="text-muted-foreground">CRUD de setores com ícones e cores. Visualização de membros por setor. Setores adicionais por usuário.</p>
                </div>

                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4" /> Comunicados Importantes (ImportantAnnouncementsSection)</h5>
                  <p className="text-muted-foreground">Comunicados com modal obrigatório. Estilos de borda customizáveis. Agendamento e expiração. Controle de leitura.</p>
                </div>

                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Calendário (CalendarSection)</h5>
                  <p className="text-muted-foreground">Calendário com eventos, reuniões e lembretes. Participantes de reuniões com confirmação (aceitar/recusar). Links de reunião. Integração com tarefas.</p>
                </div>

                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><Mail className="h-4 w-4" /> Disparo de Feedback (FeedbackEmailSection)</h5>
                  <p className="text-muted-foreground">Envio de e-mails de feedback mensal via Resend API. Templates personalizáveis.</p>
                </div>

                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><Trash2 className="h-4 w-4" /> Exclusão de Dados (DataManagementSection)</h5>
                  <p className="text-muted-foreground">Exclusão controlada de dados com auditoria automática. Logs de todas as exclusões.</p>
                </div>

                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Logs do Sistema (LogsSection)</h5>
                  <p className="text-muted-foreground">Visualização de logs de auditoria. Filtros por ação, tabela, data e usuário. Apenas admin principal.</p>
                </div>

                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><HardDrive className="h-4 w-4" /> Armazenamento (StorageMonitoringSection)</h5>
                  <p className="text-muted-foreground">Monitoramento do uso de storage nos buckets. Visualização de arquivos e ocupação. Apenas admin principal.</p>
                </div>

                <div className="border-l-2 border-primary pl-3">
                  <h5 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4" /> Eventos Mensais (EventHistorySection)</h5>
                  <p className="text-muted-foreground">Histórico de campanhas e eventos sazonais. Efeitos visuais temáticos.</p>
                </div>
              </div>
            </CollapsibleSection>
          </div>

          {/* 6. Estrutura de Arquivos */}
          <div id="doc-file-structure" className="scroll-mt-4">
            <CollapsibleSection title="6. Estrutura de Arquivos" icon={FileText}>
              <CodeBlock>{`src/
├── App.tsx                  # Roteamento principal (React Router)
├── main.tsx                 # Ponto de entrada da aplicação
├── index.css                # Design tokens (variáveis CSS HSL)
├── assets/                  # Imagens e logos
│   ├── app-logo.png
│   ├── logo-servsul.png
│   └── planner-empty-illustration.png
├── components/
│   ├── layout/              # Componentes de layout
│   │   ├── Header.tsx       # Cabeçalho com busca e notificações
│   │   ├── Sidebar.tsx      # Menu lateral com navegação
│   │   ├── MobileHeader.tsx # Cabeçalho mobile
│   │   ├── MobileNavigation.tsx # Navegação inferior mobile
│   │   └── NotificationPanel.tsx # Painel de notificações
│   ├── sections/            # Seções/páginas principais
│   │   ├── HomeSection.tsx
│   │   ├── ChatSection.tsx
│   │   ├── AnnouncementsSection.tsx
│   │   ├── BirthdaysSection.tsx
│   │   ├── TaskBoardSection.tsx    # ~2900 linhas (quadro Kanban completo)
│   │   ├── ManagementSection.tsx
│   │   ├── PeopleManagementSection.tsx
│   │   ├── SectorManagementSection.tsx
│   │   ├── CalendarSection.tsx
│   │   ├── ImportantAnnouncementsSection.tsx
│   │   ├── FeedbackEmailSection.tsx
│   │   ├── DataManagementSection.tsx
│   │   ├── LogsSection.tsx
│   │   ├── StorageMonitoringSection.tsx
│   │   ├── EventHistorySection.tsx
│   │   ├── FacialRegistrationSection.tsx
│   │   └── DocumentationSection.tsx # Esta documentação
│   ├── chat/                # Componentes de chat
│   │   ├── ChatInput.tsx    # Input com menções e formatação
│   │   ├── ChatMessage.tsx  # Renderização de mensagens
│   │   ├── DirectMessageChat/List.tsx
│   │   ├── PrivateGroupChat/List.tsx
│   │   ├── CardMentionPicker.tsx  # Picker de cards (@card)
│   │   ├── UserMentionPicker.tsx  # Picker de usuários (@user)
│   │   └── TypingIndicator.tsx
│   ├── tasks/               # Componentes do quadro de tarefas
│   │   ├── TaskDetailDialog.tsx   # Dialog de detalhes do card
│   │   ├── ReportDialog.tsx       # Relatórios do quadro
│   │   ├── AutomationRulesPanel.tsx # Motor SE→ENTÃO
│   │   ├── OperationModePanel.tsx
│   │   ├── AutoSubtasksConfig.tsx # Config auto-subtarefas
│   │   ├── TaskFilterPanel.tsx    # Filtros de tarefas
│   │   └── taskConstants.ts       # Constantes (cores, fundos)
│   ├── ui/                  # shadcn/ui components (~50 componentes)
│   ├── user/                # Perfil, presença, status
│   ├── pwa/                 # InstallPrompt, OfflineIndicator
│   ├── birthday/            # Modal de celebração
│   ├── announcements/       # Modal de comunicados
│   ├── chatbot/             # Widget de chatbot
│   ├── facial/              # Câmeras de reconhecimento facial
│   ├── onboarding/          # Tela de onboarding
│   └── seasonal/            # Efeitos sazonais
├── contexts/
│   └── AuthContext.tsx       # Contexto de autenticação global
├── hooks/                   # 30+ hooks customizados
│   ├── useData.ts           # Hook geral de dados
│   ├── useBoardTasks.ts     # CRUD de tasks no quadro
│   ├── useTaskBoards.ts     # CRUD de quadros e colunas
│   ├── useDirectMessages.ts # Mensagens diretas
│   ├── usePrivateGroups.ts  # Grupos privados
│   ├── useNotifications.ts  # Sistema de notificações
│   ├── usePresence.ts       # Status online/offline
│   ├── useFaceRecognition.ts # Reconhecimento facial
│   ├── useFileUpload.ts     # Upload de arquivos
│   └── ... (20+ outros hooks)
├── integrations/
│   └── supabase/
│       ├── client.ts        # Cliente Supabase (auto-gerado)
│       └── types.ts         # Types do banco (auto-gerado)
├── lib/
│   ├── utils.ts             # Utilitário cn() (clsx + tailwind-merge)
│   └── chatFormatUtils.tsx  # Formatação de mensagens
└── pages/
    ├── Auth.tsx             # Página de login/cadastro
    ├── Index.tsx            # Página principal (roteamento de seções)
    └── NotFound.tsx         # Página 404

supabase/
├── config.toml              # Configuração do projeto Supabase
└── functions/               # Edge Functions (Deno)
    ├── create-admin/        # Criação de admin
    ├── register-user/       # Registro de usuário
    ├── register-facial-data/ # Cadastro facial
    ├── facial-login/        # Login facial
    ├── get-facial-data/     # Consulta dados faciais
    ├── get-public-sectors/  # Setores públicos
    ├── update-user-permissions/ # Atualizar permissões
    ├── delete-data/         # Exclusão de dados
    ├── send-announcement-email/ # E-mail de aviso
    ├── send-feedback-email/ # E-mail de feedback
    ├── process-automations/ # Motor de automações
    └── duplicate-scheduled-cards/ # Duplicação agendada

public/
├── manifest.json            # PWA manifest
├── sw.js                    # Service Worker
├── robots.txt               # SEO
└── icons/                   # Ícones PWA`}</CodeBlock>
            </CollapsibleSection>
          </div>

          {/* 7. Hooks */}
          <div id="doc-hooks" className="scroll-mt-4">
            <CollapsibleSection title="7. Hooks Customizados" icon={Zap}>
              <p>O sistema utiliza <strong>30+ hooks customizados</strong> para encapsular lógica de negócio e acesso ao banco:</p>
              <div className="border border-border rounded-md overflow-hidden">
                <TableRow label="useData" value="Hook principal de dados. Carrega profiles, sectors e users ativos." />
                <TableRow label="useBoardTasks" value="CRUD completo de tasks em um quadro. Inclui create, update, delete, move, reorder, archive." />
                <TableRow label="useTaskBoards" value="CRUD de quadros Kanban, membros e colunas. Inclui criação de colunas padrão." />
                <TableRow label="useSubtasks / useSubtaskGroups" value="Gerenciamento de subtarefas e grupos hierárquicos." />
                <TableRow label="useTaskLabels" value="CRUD de etiquetas coloridas e atribuição a tasks." />
                <TableRow label="useTaskAssignees" value="Múltiplos responsáveis por task." />
                <TableRow label="useTaskActivities" value="Registro e consulta do histórico de atividades." />
                <TableRow label="useAutomationRules" value="Motor de automações SE→ENTÃO." />
                <TableRow label="useWorkflowRules" value="Regras de fluxo entre colunas." />
                <TableRow label="useCardDuplications" value="Regras de duplicação automática." />
                <TableRow label="useColumnAutoSubtasks" value="Subtarefas automáticas por coluna." />
                <TableRow label="useWorkloadAlerts" value="Alertas de sobrecarga." />
                <TableRow label="useDirectMessages" value="Mensagens diretas entre usuários com realtime." />
                <TableRow label="usePrivateGroups" value="Grupos privados de chat." />
                <TableRow label="useAnnouncements" value="CRUD de avisos com comentários e leitura." />
                <TableRow label="useImportantAnnouncements" value="Comunicados importantes com modal obrigatório." />
                <TableRow label="useNotifications" value="Sistema de notificações com contadores." />
                <TableRow label="usePresence" value="Status online/offline via heartbeat." />
                <TableRow label="useTypingIndicator" value="Indicador de digitação no chat." />
                <TableRow label="useFaceRecognition" value="Captura e comparação de descritores faciais." />
                <TableRow label="useFileUpload" value="Upload de arquivos para Storage com progresso." />
                <TableRow label="useSound" value="Reprodução de sons de notificação." />
                <TableRow label="usePWA" value="Detecção de instalação PWA e prompt." />
                <TableRow label="useOnboarding" value="Fluxo de onboarding para novos usuários." />
                <TableRow label="useBirthdayCelebration" value="Detecção e celebração de aniversários." />
                <TableRow label="useSectorManagement" value="CRUD de setores." />
                <TableRow label="useSupervisorTeam" value="Gestão da equipe do supervisor." />
                <TableRow label="useTeamAnalytics" value="Analytics de produtividade da equipe." />
                <TableRow label="useMeetingStatus" value="Status de reuniões do calendário." />
              </div>
            </CollapsibleSection>
          </div>

          {/* 8. Edge Functions */}
          <div id="doc-edge-functions" className="scroll-mt-4">
            <CollapsibleSection title="8. Funções de Backend (Edge Functions)" icon={Server}>
              <p>As Edge Functions rodam em Deno runtime e são deployadas automaticamente. Utilizam <code className="bg-muted px-1 rounded text-xs">SUPABASE_SERVICE_ROLE_KEY</code> para operações privilegiadas.</p>
              <div className="border border-border rounded-md overflow-hidden">
                <TableRow label="create-admin" value="Cria o primeiro admin do sistema (bootstrap). Verifica se já existe admin." />
                <TableRow label="register-user" value="Registra novo usuário via auth.admin.createUser(). Cria profile e permissions automaticamente." />
                <TableRow label="update-user-permissions" value="Atualiza permissões granulares do usuário na tabela user_permissions." />
                <TableRow label="register-facial-data" value="Salva descritores faciais (128-dimensional float array) na tabela user_facial_data." />
                <TableRow label="facial-login" value="Compara descritores faciais enviados com todos os cadastrados. Retorna match se distância < threshold." />
                <TableRow label="get-facial-data" value="Consulta dados faciais de um usuário específico." />
                <TableRow label="get-public-sectors" value="Retorna setores para exibição pública (tela de login)." />
                <TableRow label="delete-data" value="Exclusão controlada de registros com audit log automático." />
                <TableRow label="send-announcement-email" value="Dispara e-mail de aviso via Resend API para todos os usuários ativos." />
                <TableRow label="send-feedback-email" value="Dispara e-mail de feedback personalizado via Resend API." />
                <TableRow label="process-automations" value="Processa regras de automação do quadro (SE task moveu ENTÃO faça X)." />
                <TableRow label="duplicate-scheduled-cards" value="Duplica cards agendados (diário/semanal/mensal) com subtarefas." />
              </div>
            </CollapsibleSection>
          </div>

          {/* 9. Storage */}
          <div id="doc-storage" className="scroll-mt-4">
            <CollapsibleSection title="9. Armazenamento de Arquivos (Storage)" icon={HardDrive}>
              <div className="border border-border rounded-md overflow-hidden">
                <TableRow label="avatars (público)" value="Fotos de perfil dos usuários. Aceita JPEG, PNG, WebP. Upload via useFileUpload." />
                <TableRow label="attachments (público)" value="Anexos de mensagens, DMs e avisos. Aceita PDF, DOC, DOCX, XLS, XLSX, ZIP, imagens. Protegido via RLS na tabela attachments." />
                <TableRow label="face-images (privado)" value="Imagens faciais para reconhecimento biométrico. Acesso restrito via Edge Functions." />
              </div>
            </CollapsibleSection>
          </div>

          {/* 10. PWA */}
          <div id="doc-pwa" className="scroll-mt-4">
            <CollapsibleSection title="10. PWA e Responsividade" icon={Smartphone}>
              <h4 className="font-semibold">Progressive Web App:</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>manifest.json:</strong> Configuração de nome, ícones, cores e display standalone</li>
                <li><strong>sw.js:</strong> Service Worker com estratégia cache-first para assets estáticos</li>
                <li><strong>InstallPrompt:</strong> Componente que detecta e sugere instalação</li>
                <li><strong>OfflineIndicator:</strong> Indicador visual quando sem conexão</li>
              </ul>

              <h4 className="font-semibold mt-3">Responsividade:</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Layout adaptativo via <code className="bg-muted px-1 rounded text-xs">useIsMobile()</code> hook</li>
                <li>Sidebar colapsável no desktop, navegação inferior no mobile</li>
                <li>Header diferenciado para mobile (MobileHeader)</li>
                <li>Quadro Kanban com scroll horizontal no mobile</li>
              </ul>
            </CollapsibleSection>
          </div>

          {/* 11. RLS */}
          <div id="doc-rls" className="scroll-mt-4">
            <CollapsibleSection title="11. Políticas de Segurança (RLS)" icon={Lock}>
              <p>Todas as tabelas possuem <strong>Row Level Security (RLS)</strong> ativado. As políticas garantem que cada usuário só acessa dados permitidos.</p>
              
              <h4 className="font-semibold mt-3">Funções Auxiliares de Segurança:</h4>
              <div className="border border-border rounded-md overflow-hidden mb-2">
                <TableRow label="is_admin()" value="Verifica se o usuário autenticado possui role 'admin'" />
                <TableRow label="has_role(_user_id, _role)" value="Verifica se um usuário possui uma role específica" />
                <TableRow label="has_autonomy_level(level)" value="Verifica hierarquia de autonomia (admin > gerente > supervisor > colaborador)" />
                <TableRow label="is_board_member(board_id)" value="Verifica se é membro ou dono de um quadro" />
                <TableRow label="is_board_owner(board_id)" value="Verifica se é dono do quadro" />
                <TableRow label="is_board_admin_or_owner(board_id)" value="Verifica se é admin ou dono do quadro" />
                <TableRow label="is_group_member(group_id)" value="Verifica se é membro de um grupo privado" />
                <TableRow label="is_group_admin(group_id)" value="Verifica se é admin de um grupo privado" />
                <TableRow label="get_current_profile_id()" value="Retorna o profile.id do usuário autenticado" />
                <TableRow label="get_current_sector_id()" value="Retorna o sector_id do perfil do usuário" />
                <TableRow label="user_has_sector_access()" value="Verifica acesso ao setor (primário, adicional ou Geral)" />
                <TableRow label="check_user_is_active()" value="Verifica se o perfil do usuário está ativo" />
              </div>

              <h4 className="font-semibold mt-3">Padrões de RLS:</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Mensagens de setor:</strong> Usuários só veem mensagens dos seus setores (primário + adicionais)</li>
                <li><strong>DMs:</strong> Apenas remetente e destinatário podem ver</li>
                <li><strong>Quadros:</strong> Apenas membros do quadro acessam tasks e colunas</li>
                <li><strong>Grupos privados:</strong> Apenas membros do grupo veem mensagens</li>
                <li><strong>Dados admin:</strong> audit_logs, user_facial_data, system_settings restritos a admins</li>
              </ul>
            </CollapsibleSection>
          </div>

          {/* 12. Realtime */}
          <div id="doc-realtime" className="scroll-mt-4">
            <CollapsibleSection title="12. Funcionalidades em Tempo Real" icon={Zap}>
              <p>O sistema utiliza <strong>Supabase Realtime</strong> (WebSockets) para sincronizar dados em tempo real entre clientes.</p>
              <div className="border border-border rounded-md overflow-hidden">
                <TableRow label="Chat por Setor" value="Novas mensagens aparecem instantaneamente para todos os membros do setor" />
                <TableRow label="Mensagens Diretas" value="DMs sincronizadas em tempo real entre remetente e destinatário" />
                <TableRow label="Grupos Privados" value="Mensagens de grupo sincronizadas para todos os membros" />
                <TableRow label="Quadros de Tarefas" value="Movimentação de cards, criação e exclusão refletidas instantaneamente" />
                <TableRow label="Colunas do Quadro" value="Adição, remoção e reordenação de colunas em tempo real" />
                <TableRow label="Avisos" value="Novos avisos e comunicados aparecem para todos os usuários" />
                <TableRow label="Notificações" value="Notificações push em tempo real" />
                <TableRow label="Presença" value="Status online/offline atualizado via heartbeat periódico" />
                <TableRow label="Digitação" value="Indicador 'está digitando...' no chat" />
              </div>

              <h4 className="font-semibold mt-3">Padrão de Implementação:</h4>
              <CodeBlock>{`// Exemplo: escutar mudanças em tasks de um quadro
const channel = supabase
  .channel(\`board-tasks-\${boardId}\`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tasks',
    filter: \`board_id=eq.\${boardId}\`
  }, () => fetchTasks())
  .subscribe();

// Cleanup
return () => supabase.removeChannel(channel);`}</CodeBlock>
            </CollapsibleSection>
          </div>

          {/* Footer */}
          <div className="text-center pt-8 pb-4 border-t border-border text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-center gap-2">
              <img src={logoServsul} alt="Servsul" className="h-6 w-6 object-contain rounded" />
              <img src={appLogo} alt="ServChat" className="h-6 w-6 object-contain rounded" />
            </div>
            <p><strong>ServChat</strong> — Plataforma de Comunicação Interna</p>
            <p>Grupo Servsul • Documentação Técnica Completa</p>
            <p>Desenvolvido com React, TypeScript, Tailwind CSS e Lovable Cloud</p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
