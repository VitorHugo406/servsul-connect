import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, ChevronDown, ChevronRight, BookOpen, Database, Code2, Layers, Shield, Zap, Users, MessageSquare, Bell, ListTodo, CalendarDays, FileText, HardDrive, Building2, Sparkles, Mail, Cake, Home, Settings, Trash2, Eye, Lock, Server, Globe, Smartphone } from 'lucide-react';
import logoServsul from '@/assets/logo-servsul.png';
import appLogo from '@/assets/app-logo.png';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

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

function InfoCard({ icon: Icon, title, value, color = 'text-primary' }: { icon: any; title: string; value: string; color?: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", color)} />
      <div className="min-w-0">
        <p className="font-semibold text-xs">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function generateDocumentationPDF() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  const addPage = () => { doc.addPage(); y = 20; };
  const checkPage = (needed: number) => { if (y + needed > 275) addPage(); };

  const sectionTitle = (text: string) => {
    checkPage(15);
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text(text, margin, y);
    y += 2;
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 8;
    doc.setTextColor(30, 30, 30);
  };

  const bodyText = (text: string) => {
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(text, pageW - margin * 2);
    checkPage(lines.length * 4.5);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 3;
  };

  const addTable = (head: string[][], body: string[][]) => {
    checkPage(20);
    autoTable(doc, {
      startY: y,
      head,
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      theme: 'grid',
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  };

  // ===== COVER =====
  doc.setFontSize(28);
  doc.setTextColor(37, 99, 235);
  doc.text('ServChat', pageW / 2, 60, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text('Plataforma de Comunicação Interna', pageW / 2, 70, { align: 'center' });
  doc.text('Grupo Servsul', pageW / 2, 78, { align: 'center' });
  doc.setFontSize(10);
  doc.text('Documentação Técnica Completa', pageW / 2, 95, { align: 'center' });
  
  const techs = ['React 18', 'TypeScript', 'Tailwind CSS', 'PostgreSQL', 'Vite', 'PWA'];
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(techs.join('  •  '), pageW / 2, 108, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pageW / 2, 280, { align: 'center' });

  // ===== TOC =====
  addPage();
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.text('Índice', margin, y);
  y += 10;
  const tocItems = [
    '1. Visão Geral do Sistema',
    '2. Stack Tecnológica',
    '3. Banco de Dados (PostgreSQL)',
    '4. Autenticação e Segurança',
    '5. Funcionalidades do Sistema',
    '6. Estrutura de Arquivos',
    '7. Hooks Customizados',
    '8. Funções de Backend (Edge Functions)',
    '9. Armazenamento de Arquivos',
    '10. PWA e Responsividade',
    '11. Políticas de Segurança (RLS)',
    '12. Funcionalidades em Tempo Real',
  ];
  doc.setFontSize(10);
  doc.setTextColor(37, 99, 235);
  tocItems.forEach(item => {
    doc.text(item, margin + 5, y);
    y += 7;
  });

  // ===== 1. VISÃO GERAL =====
  addPage();
  sectionTitle('1. Visão Geral do Sistema');
  bodyText('O ServChat é uma plataforma web interna desenvolvida para o Grupo Servsul, focada em comunicação corporativa, gestão de tarefas e colaboração entre setores. O sistema foi projetado para centralizar toda a comunicação interna, substituindo ferramentas fragmentadas.');
  bodyText('Principais Objetivos:');
  bodyText('• Centralizar a comunicação interna entre setores da empresa\n• Gerenciar tarefas com quadros estilo Kanban\n• Publicar avisos e comunicados oficiais com controle de leitura\n• Mural de aniversariantes e eventos sazonais\n• Controle de acesso por níveis de autonomia\n• Reconhecimento facial para autenticação biométrica\n• Calendário integrado com reuniões e lembretes\n• Disparo de e-mails de feedback via Resend API');

  // ===== 2. STACK =====
  sectionTitle('2. Stack Tecnológica');
  bodyText('Frontend:');
  addTable(
    [['Tecnologia', 'Descrição']],
    [
      ['TypeScript', 'Tipagem estática sobre JavaScript'],
      ['React 18.3', 'Biblioteca de interfaces declarativas'],
      ['Vite', 'Bundler rápido com HMR'],
      ['Tailwind CSS 4', 'Design tokens semânticos (HSL)'],
      ['shadcn/ui', 'Radix UI primitives + Tailwind'],
      ['Framer Motion', 'Transições e animações declarativas'],
      ['React Router DOM v6', 'Navegação SPA'],
      ['React Hook Form + Zod', 'Validação de schemas'],
      ['Recharts', 'Gráficos baseados em SVG'],
      ['Lucide React', 'Ícones SVG tree-shakable'],
      ['jsPDF + autotable', 'Geração de relatórios PDF'],
      ['xlsx', 'Leitura/escrita de planilhas'],
      ['PWA', 'Service Worker com cache offline'],
    ]
  );
  bodyText('Backend (Lovable Cloud):');
  addTable(
    [['Tecnologia', 'Descrição']],
    [
      ['PostgreSQL', 'Banco de dados relacional (Supabase)'],
      ['Supabase Auth', 'JWT, email/senha, reconhecimento facial'],
      ['PostgREST', 'API REST auto-gerado'],
      ['Supabase Realtime', 'WebSockets para sync'],
      ['Edge Functions', 'Deno runtime (serverless)'],
      ['Supabase Storage', 'Buckets para avatars, anexos, face-images'],
      ['Resend API', 'Disparo de e-mails transacionais'],
      ['Row Level Security', 'RLS em todas as tabelas'],
    ]
  );

  // ===== 3. DATABASE =====
  checkPage(30);
  sectionTitle('3. Banco de Dados (PostgreSQL)');
  bodyText('O banco de dados PostgreSQL contém 35+ tabelas organizadas por domínio funcional. Todas possuem Row Level Security (RLS) ativado.');

  bodyText('Comunicação:');
  addTable([['Tabela', 'Descrição']], [
    ['messages', 'Mensagens do chat por setor (id, author_id, sector_id, content, created_at)'],
    ['direct_messages', 'Mensagens diretas entre usuários (sender_id, receiver_id, content, is_read)'],
    ['private_groups', 'Grupos privados de chat (name, description, avatar_url, created_by)'],
    ['private_group_messages', 'Mensagens dentro dos grupos privados'],
    ['private_group_members', 'Membros de cada grupo com roles (admin/member)'],
    ['private_group_message_reads', 'Controle de última leitura por grupo'],
  ]);

  bodyText('Avisos e Comunicados:');
  addTable([['Tabela', 'Descrição']], [
    ['announcements', 'Avisos gerais com prioridade, pin e expiração'],
    ['announcement_comments', 'Comentários nos avisos'],
    ['announcement_reads', 'Registro de leitura por usuário'],
    ['important_announcements', 'Comunicados importantes com modal obrigatório'],
    ['important_announcement_reads', 'Controle de leitura dos comunicados importantes'],
  ]);

  bodyText('Gestão de Tarefas (Kanban):');
  addTable([['Tabela', 'Descrição']], [
    ['task_boards', 'Quadros Kanban (name, description, owner_id, background_image)'],
    ['task_board_columns', 'Colunas do quadro com automações'],
    ['task_board_members', 'Membros do quadro com roles (owner, admin, member)'],
    ['tasks', 'Cards/tarefas (title, description, status, priority, assigned_to, due_date)'],
    ['task_subtasks', 'Subtarefas de cada card com grupo opcional'],
    ['subtask_groups', 'Grupos de subtarefas dentro de um card'],
    ['task_comments', 'Comentários dentro dos cards'],
    ['task_activities', 'Histórico de atividades'],
    ['task_labels', 'Etiquetas coloridas por quadro'],
    ['task_label_assignments', 'Associação etiqueta ↔ task'],
    ['task_assignees', 'Múltiplos responsáveis por task'],
    ['task_auto_duplications', 'Regras de duplicação automática'],
    ['task_automation_rules', 'Motor de automações SE→ENTÃO'],
    ['column_auto_subtasks', 'Subtarefas automáticas por coluna'],
    ['column_workflow_rules', 'Regras de fluxo entre colunas'],
    ['board_share_links', 'Links de compartilhamento de quadros'],
    ['board_join_requests', 'Solicitações de entrada em quadros'],
    ['workload_alerts', 'Alertas de sobrecarga de trabalho'],
  ]);

  bodyText('Usuários e Permissões:');
  addTable([['Tabela', 'Descrição']], [
    ['profiles', 'Perfis de usuário (name, email, avatar_url, birth_date, sector_id, autonomy_level)'],
    ['user_roles', 'Roles do sistema (admin, gerente, supervisor, colaborador, gestor, diretoria)'],
    ['user_permissions', 'Permissões granulares'],
    ['user_additional_sectors', 'Setores adicionais vinculados ao usuário'],
    ['user_presence', 'Status online/offline com heartbeat'],
    ['user_notifications', 'Notificações do sistema'],
    ['user_facial_data', 'Dados biométricos para reconhecimento facial'],
    ['supervisor_team_members', 'Vinculação supervisor ↔ membros'],
  ]);

  bodyText('Outros:');
  addTable([['Tabela', 'Descrição']], [
    ['sectors', 'Setores/departamentos com cor e ícone'],
    ['calendar_events', 'Eventos do calendário (reuniões, lembretes)'],
    ['meeting_participants', 'Participantes de reuniões com status'],
    ['attachments', 'Anexos de mensagens, DMs e avisos'],
    ['audit_logs', 'Logs de auditoria de todas as exclusões'],
    ['system_settings', 'Configurações do sistema'],
  ]);

  // ===== 4. AUTH =====
  sectionTitle('4. Autenticação e Segurança');
  bodyText('Métodos de Autenticação:\n• E-mail e Senha: Cadastro via formulário com verificação de e-mail obrigatória\n• Reconhecimento Facial: Login biométrico usando face-api.js (descriptors armazenados no banco)');
  addTable([['Nível', 'Descrição']], [
    ['admin', 'Acesso total ao sistema, gerenciamento de usuários e configurações'],
    ['gerente', 'Acesso à gestão, avisos e quadros de tarefas'],
    ['gestor', 'Acesso similar ao gerente com foco em gestão'],
    ['diretoria', 'Acesso a relatórios e gerenciamento'],
    ['supervisor', 'Gestão de equipe e visibilidade de tarefas'],
    ['colaborador', 'Acesso básico: chat, avisos, tarefas atribuídas'],
  ]);
  bodyText('Admin Principal: Identificado pelo e-mail adminservchat@servsul.com.br com acesso exclusivo a Logs, Armazenamento e Documentação.');

  // ===== 5. FEATURES =====
  sectionTitle('5. Funcionalidades do Sistema');
  addTable([['Módulo', 'Descrição']], [
    ['Início (HomeSection)', 'Dashboard com cards de resumo: tarefas, aniversariantes, avisos, atividade recente'],
    ['Chat por Setores', 'Chat em tempo real por setor. Menções @usuário e @card. Formatação. DMs e grupos privados'],
    ['Avisos Gerais', 'Publicação com prioridade, expiração, agendamento, comentários, controle de leitura, anexos'],
    ['Aniversariantes', 'Mural do mês com celebração animada (confetti). Modal especial no dia do aniversário'],
    ['Gestão de Tarefas', 'Kanban completo: múltiplos quadros, colunas, cards, subtarefas, etiquetas, automações, drag-and-drop, duplicação automática, templates, workflow, relatórios, alertas de sobrecarga'],
    ['Gestão de Pessoas', 'Visão de equipe para supervisores. Analytics de produtividade'],
    ['Gerenciamento', 'CRUD de usuários, roles, permissões, cadastro facial, alteração de perfil'],
    ['Gestão de Setores', 'CRUD de setores com ícones e cores. Membros por setor'],
    ['Comunicados Importantes', 'Modal obrigatório com estilos customizáveis. Agendamento e controle de leitura'],
    ['Calendário', 'Eventos, reuniões, lembretes. Participantes com confirmação. Links de reunião'],
    ['Disparo de Feedback', 'Envio de e-mails de feedback mensal via Resend API'],
    ['Exclusão de Dados', 'Exclusão controlada com auditoria automática e logs'],
    ['Logs do Sistema', 'Visualização de audit logs. Filtros. Apenas admin principal'],
    ['Armazenamento', 'Monitoramento de storage nos buckets. Apenas admin principal'],
    ['Eventos Mensais', 'Histórico de campanhas e eventos sazonais'],
  ]);

  // ===== 6. FILE STRUCTURE =====
  sectionTitle('6. Estrutura de Arquivos');
  bodyText('src/\n├── App.tsx — Roteamento principal (React Router)\n├── main.tsx — Ponto de entrada da aplicação\n├── index.css — Design tokens (variáveis CSS HSL)\n├── components/\n│   ├── layout/ — Header, Sidebar, MobileHeader, MobileNavigation, NotificationPanel\n│   ├── sections/ — 16 seções/páginas principais do sistema\n│   ├── chat/ — ChatInput, ChatMessage, DM, Grupos, Mentions, Typing\n│   ├── tasks/ — TaskDetailDialog, ReportDialog, AutomationRules, Filters\n│   ├── ui/ — ~50 componentes shadcn/ui\n│   ├── user/ — Perfil, presença, status\n│   ├── pwa/ — InstallPrompt, OfflineIndicator\n│   └── (birthday, announcements, chatbot, facial, onboarding, seasonal)\n├── contexts/AuthContext.tsx — Contexto de autenticação global\n├── hooks/ — 30+ hooks customizados\n├── integrations/supabase/ — client.ts e types.ts (auto-gerados)\n├── lib/ — utils.ts, chatFormatUtils.tsx\n└── pages/ — Auth.tsx, Index.tsx, NotFound.tsx');

  bodyText('supabase/functions/ — 12 Edge Functions:\ncreate-admin, register-user, register-facial-data, facial-login, get-facial-data, get-public-sectors, update-user-permissions, delete-data, send-announcement-email, send-feedback-email, process-automations, duplicate-scheduled-cards');

  // ===== 7. HOOKS =====
  sectionTitle('7. Hooks Customizados');
  addTable([['Hook', 'Descrição']], [
    ['useData', 'Hook principal de dados. Carrega profiles, sectors e users ativos'],
    ['useBoardTasks', 'CRUD completo de tasks em um quadro (create, update, delete, move, archive)'],
    ['useTaskBoards', 'CRUD de quadros Kanban, membros e colunas'],
    ['useSubtasks / useSubtaskGroups', 'Gerenciamento de subtarefas e grupos hierárquicos'],
    ['useTaskLabels', 'CRUD de etiquetas coloridas e atribuição a tasks'],
    ['useTaskAssignees', 'Múltiplos responsáveis por task'],
    ['useTaskActivities', 'Registro e consulta do histórico de atividades'],
    ['useAutomationRules', 'Motor de automações SE→ENTÃO'],
    ['useWorkflowRules', 'Regras de fluxo entre colunas'],
    ['useCardDuplications', 'Regras de duplicação automática'],
    ['useColumnAutoSubtasks', 'Subtarefas automáticas por coluna'],
    ['useWorkloadAlerts', 'Alertas de sobrecarga'],
    ['useDirectMessages', 'Mensagens diretas entre usuários com realtime'],
    ['usePrivateGroups', 'Grupos privados de chat'],
    ['useAnnouncements', 'CRUD de avisos com comentários e leitura'],
    ['useImportantAnnouncements', 'Comunicados importantes com modal obrigatório'],
    ['useNotifications', 'Sistema de notificações com contadores'],
    ['usePresence', 'Status online/offline via heartbeat'],
    ['useTypingIndicator', 'Indicador de digitação no chat'],
    ['useFaceRecognition', 'Captura e comparação de descritores faciais'],
    ['useFileUpload', 'Upload de arquivos para Storage com progresso'],
    ['useSound', 'Reprodução de sons de notificação'],
    ['usePWA', 'Detecção de instalação PWA e prompt'],
    ['useOnboarding', 'Fluxo de onboarding para novos usuários'],
    ['useBirthdayCelebration', 'Detecção e celebração de aniversários'],
    ['useSectorManagement', 'CRUD de setores'],
    ['useSupervisorTeam', 'Gestão da equipe do supervisor'],
    ['useTeamAnalytics', 'Analytics de produtividade da equipe'],
    ['useMeetingStatus', 'Status de reuniões do calendário'],
  ]);

  // ===== 8. EDGE FUNCTIONS =====
  sectionTitle('8. Funções de Backend (Edge Functions)');
  bodyText('As Edge Functions rodam em Deno runtime e são deployadas automaticamente. Utilizam SUPABASE_SERVICE_ROLE_KEY para operações privilegiadas.');
  addTable([['Função', 'Descrição']], [
    ['create-admin', 'Cria o primeiro admin do sistema (bootstrap)'],
    ['register-user', 'Registra novo usuário via auth.admin.createUser(). Cria profile e permissions'],
    ['update-user-permissions', 'Atualiza permissões granulares na tabela user_permissions'],
    ['register-facial-data', 'Salva descritores faciais (128-dim float array)'],
    ['facial-login', 'Compara descritores faciais. Retorna match se distância < threshold'],
    ['get-facial-data', 'Consulta dados faciais de um usuário'],
    ['get-public-sectors', 'Retorna setores para exibição pública'],
    ['delete-data', 'Exclusão controlada com audit log automático'],
    ['send-announcement-email', 'Dispara e-mail de aviso via Resend API'],
    ['send-feedback-email', 'Dispara e-mail de feedback personalizado via Resend API'],
    ['process-automations', 'Processa regras de automação do quadro'],
    ['duplicate-scheduled-cards', 'Duplica cards agendados (diário/semanal/mensal)'],
  ]);

  // ===== 9. STORAGE =====
  sectionTitle('9. Armazenamento de Arquivos (Storage)');
  addTable([['Bucket', 'Descrição']], [
    ['avatars (público)', 'Fotos de perfil. Aceita JPEG, PNG, WebP'],
    ['attachments (público)', 'Anexos de mensagens, DMs e avisos. PDF, DOC, XLS, ZIP, imagens'],
    ['face-images (privado)', 'Imagens faciais para reconhecimento biométrico. Acesso via Edge Functions'],
  ]);

  // ===== 10. PWA =====
  sectionTitle('10. PWA e Responsividade');
  bodyText('Progressive Web App:\n• manifest.json: Configuração de nome, ícones, cores e display standalone\n• sw.js: Service Worker com estratégia cache-first para assets estáticos\n• InstallPrompt: Componente que detecta e sugere instalação\n• OfflineIndicator: Indicador visual quando sem conexão');
  bodyText('Responsividade:\n• Layout adaptativo via useIsMobile() hook\n• Sidebar colapsável no desktop, navegação inferior no mobile\n• Header diferenciado para mobile (MobileHeader)\n• Quadro Kanban com scroll horizontal no mobile');

  // ===== 11. RLS =====
  sectionTitle('11. Políticas de Segurança (RLS)');
  bodyText('Todas as tabelas possuem Row Level Security (RLS) ativado.');
  addTable([['Função', 'Descrição']], [
    ['is_admin()', 'Verifica se o usuário possui role admin'],
    ['has_role(_user_id, _role)', 'Verifica se possui uma role específica'],
    ['has_autonomy_level(level)', 'Verifica hierarquia de autonomia'],
    ['is_board_member(board_id)', 'Verifica se é membro ou dono do quadro'],
    ['is_board_owner(board_id)', 'Verifica se é dono do quadro'],
    ['is_group_member(group_id)', 'Verifica se é membro de um grupo privado'],
    ['get_current_profile_id()', 'Retorna o profile.id do usuário autenticado'],
    ['get_current_sector_id()', 'Retorna o sector_id do perfil'],
    ['user_has_sector_access()', 'Verifica acesso ao setor (primário + adicional + Geral)'],
    ['check_user_is_active()', 'Verifica se o perfil está ativo'],
  ]);
  bodyText('Padrões:\n• Mensagens de setor: só setores do usuário\n• DMs: apenas remetente e destinatário\n• Quadros: apenas membros acessam tasks e colunas\n• Grupos privados: apenas membros veem mensagens\n• Dados admin: audit_logs, user_facial_data, system_settings restritos');

  // ===== 12. REALTIME =====
  sectionTitle('12. Funcionalidades em Tempo Real');
  bodyText('O sistema utiliza Supabase Realtime (WebSockets) para sincronizar dados em tempo real entre clientes.');
  addTable([['Recurso', 'Descrição']], [
    ['Chat por Setor', 'Novas mensagens instantâneas para membros do setor'],
    ['Mensagens Diretas', 'DMs sincronizadas em tempo real'],
    ['Grupos Privados', 'Mensagens de grupo sincronizadas para todos os membros'],
    ['Quadros de Tarefas', 'Movimentação de cards refletida instantaneamente'],
    ['Colunas do Quadro', 'Adição, remoção e reordenação em tempo real'],
    ['Avisos', 'Novos avisos aparecem para todos os usuários'],
    ['Notificações', 'Notificações push em tempo real'],
    ['Presença', 'Status online/offline via heartbeat periódico'],
    ['Digitação', 'Indicador "está digitando..." no chat'],
  ]);

  // ===== FOOTER =====
  checkPage(20);
  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('ServChat — Plataforma de Comunicação Interna • Grupo Servsul', pageW / 2, y, { align: 'center' });
  y += 5;
  doc.text('Desenvolvido com React, TypeScript, Tailwind CSS e Lovable Cloud', pageW / 2, y, { align: 'center' });
  y += 5;
  doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, pageW / 2, y, { align: 'center' });

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`Página ${i} de ${totalPages}`, pageW / 2, 290, { align: 'center' });
  }

  doc.save('ServChat_Documentacao_Tecnica.pdf');
  toast.success('Documentação PDF baixada com sucesso!');
}

export function DocumentationSection() {
  const [generating, setGenerating] = useState(false);

  const handleDownloadPDF = () => {
    setGenerating(true);
    setTimeout(() => {
      try {
        generateDocumentationPDF();
      } catch (e) {
        toast.error('Erro ao gerar PDF');
        console.error(e);
      }
      setGenerating(false);
    }, 100);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold">Documentação Técnica</h1>
            <p className="text-xs text-muted-foreground">ServChat — Grupo Servsul</p>
          </div>
        </div>
        <Button onClick={handleDownloadPDF} disabled={generating} size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          {generating ? 'Gerando...' : 'Baixar PDF'}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

          {/* Cover */}
          <div className="text-center space-y-3 pb-4 border-b border-border">
            <div className="flex items-center justify-center gap-4">
              <img src={logoServsul} alt="Grupo Servsul" className="h-14 w-14 object-contain rounded-xl" />
              <img src={appLogo} alt="ServChat" className="h-14 w-14 object-contain rounded-xl" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">ServChat</h1>
            <p className="text-muted-foreground text-sm">Plataforma de Comunicação Interna — Grupo Servsul</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Badge variant="secondary">React 18</Badge>
              <Badge variant="secondary">TypeScript</Badge>
              <Badge variant="secondary">Tailwind CSS</Badge>
              <Badge variant="secondary">PostgreSQL</Badge>
              <Badge variant="secondary">Vite</Badge>
              <Badge variant="secondary">PWA</Badge>
            </div>
          </div>

          {/* TOC — horizontal 3 col */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Índice</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                {[
                  { id: 'overview', label: '1. Visão Geral' },
                  { id: 'tech-stack', label: '2. Stack Tecnológica' },
                  { id: 'database', label: '3. Banco de Dados' },
                  { id: 'auth', label: '4. Autenticação' },
                  { id: 'features', label: '5. Funcionalidades' },
                  { id: 'file-structure', label: '6. Estrutura de Arquivos' },
                  { id: 'hooks', label: '7. Hooks' },
                  { id: 'edge-functions', label: '8. Edge Functions' },
                  { id: 'storage', label: '9. Storage' },
                  { id: 'pwa', label: '10. PWA' },
                  { id: 'rls', label: '11. RLS' },
                  { id: 'realtime', label: '12. Realtime' },
                ].map(item => (
                  <a key={item.id} href={`#doc-${item.id}`} className="text-xs text-primary hover:underline py-0.5">{item.label}</a>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 1. Visão Geral */}
          <div id="doc-overview" className="scroll-mt-4">
            <CollapsibleSection title="1. Visão Geral do Sistema" icon={Globe} defaultOpen>
              <p>
                O <strong>ServChat</strong> é uma plataforma web interna desenvolvida para o <strong>Grupo Servsul</strong>, focada em comunicação corporativa, gestão de tarefas e colaboração entre setores.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                <InfoCard icon={MessageSquare} title="Comunicação" value="Chat por setores, DMs, grupos privados, menções" />
                <InfoCard icon={ListTodo} title="Gestão de Tarefas" value="Kanban com automações, subtarefas, etiquetas" />
                <InfoCard icon={Bell} title="Avisos" value="Comunicados oficiais com controle de leitura" />
                <InfoCard icon={Shield} title="Segurança" value="RLS, roles, reconhecimento facial" />
                <InfoCard icon={CalendarDays} title="Calendário" value="Reuniões, lembretes, prazos integrados" />
                <InfoCard icon={Mail} title="E-mails" value="Feedback mensal via Resend API" />
                <InfoCard icon={Cake} title="Aniversariantes" value="Mural com celebração animada" />
                <InfoCard icon={Eye} title="Presença" value="Status online/offline em tempo real" />
                <InfoCard icon={Smartphone} title="PWA" value="Instalável, funciona offline" />
              </div>
            </CollapsibleSection>
          </div>

          {/* 2. Stack */}
          <div id="doc-tech-stack" className="scroll-mt-4">
            <CollapsibleSection title="2. Stack Tecnológica" icon={Code2} defaultOpen>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Frontend:</h4>
                  <div className="border border-border rounded-md overflow-hidden">
                    <TableRow label="Linguagem" value="TypeScript" />
                    <TableRow label="Framework" value="React 18.3" />
                    <TableRow label="Build Tool" value="Vite" />
                    <TableRow label="Estilização" value="Tailwind CSS 4 (HSL)" />
                    <TableRow label="Componentes" value="shadcn/ui (Radix)" />
                    <TableRow label="Animações" value="Framer Motion" />
                    <TableRow label="Roteamento" value="React Router v6" />
                    <TableRow label="Formulários" value="React Hook Form + Zod" />
                    <TableRow label="Gráficos" value="Recharts" />
                    <TableRow label="Ícones" value="Lucide React" />
                    <TableRow label="PDF/Excel" value="jsPDF + xlsx" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Backend (Lovable Cloud):</h4>
                  <div className="border border-border rounded-md overflow-hidden">
                    <TableRow label="Banco de Dados" value="PostgreSQL (Supabase)" />
                    <TableRow label="Autenticação" value="Supabase Auth (JWT)" />
                    <TableRow label="API REST" value="PostgREST auto-gerado" />
                    <TableRow label="Realtime" value="WebSockets (Supabase)" />
                    <TableRow label="Functions" value="Edge Functions (Deno)" />
                    <TableRow label="Storage" value="Buckets (avatars, anexos)" />
                    <TableRow label="E-mail" value="Resend API" />
                    <TableRow label="Segurança" value="Row Level Security" />
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          </div>

          {/* 3. Database */}
          <div id="doc-database" className="scroll-mt-4">
            <CollapsibleSection title="3. Banco de Dados (PostgreSQL)" icon={Database}>
              <p>O banco de dados contém <strong>35+ tabelas</strong> com RLS ativado. Organização por domínio:</p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                <div>
                  <h5 className="font-medium text-primary text-xs mb-1">💬 Comunicação</h5>
                  <div className="border border-border rounded-md overflow-hidden">
                    <TableRow label="messages" value="Chat por setor (author_id, sector_id, content)" />
                    <TableRow label="direct_messages" value="DMs (sender_id, receiver_id, is_read)" />
                    <TableRow label="private_groups" value="Grupos privados (name, created_by)" />
                    <TableRow label="private_group_messages" value="Msgs dentro dos grupos" />
                    <TableRow label="private_group_members" value="Membros com roles" />
                    <TableRow label="private_group_message_reads" value="Controle de leitura" />
                  </div>
                </div>
                <div>
                  <h5 className="font-medium text-primary text-xs mb-1">📢 Avisos e Comunicados</h5>
                  <div className="border border-border rounded-md overflow-hidden">
                    <TableRow label="announcements" value="Avisos com prioridade, pin, expiração" />
                    <TableRow label="announcement_comments" value="Comentários nos avisos" />
                    <TableRow label="announcement_reads" value="Leitura por usuário" />
                    <TableRow label="important_announcements" value="Modal obrigatório com border_style" />
                    <TableRow label="important_announcement_reads" value="Leitura dos comunicados" />
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <h5 className="font-medium text-primary text-xs mb-1">📋 Gestão de Tarefas (Kanban)</h5>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  <div className="border border-border rounded-md overflow-hidden">
                    <TableRow label="task_boards" value="Quadros (name, owner_id, background)" />
                    <TableRow label="task_board_columns" value="Colunas com automações" />
                    <TableRow label="task_board_members" value="Membros (owner, admin, member)" />
                    <TableRow label="tasks" value="Cards (title, status, priority, due_date)" />
                    <TableRow label="task_subtasks" value="Subtarefas com grupo opcional" />
                    <TableRow label="subtask_groups" value="Grupos de subtarefas" />
                    <TableRow label="task_comments" value="Comentários nos cards" />
                    <TableRow label="task_activities" value="Histórico de atividades" />
                    <TableRow label="task_labels" value="Etiquetas coloridas" />
                  </div>
                  <div className="border border-border rounded-md overflow-hidden">
                    <TableRow label="task_label_assignments" value="Etiqueta ↔ task" />
                    <TableRow label="task_assignees" value="Múltiplos responsáveis" />
                    <TableRow label="task_auto_duplications" value="Duplicação automática" />
                    <TableRow label="task_automation_rules" value="Motor SE→ENTÃO" />
                    <TableRow label="column_auto_subtasks" value="Auto-subtarefas por coluna" />
                    <TableRow label="column_workflow_rules" value="Regras de fluxo" />
                    <TableRow label="board_share_links" value="Links de compartilhamento" />
                    <TableRow label="board_join_requests" value="Solicitações de entrada" />
                    <TableRow label="workload_alerts" value="Alertas de sobrecarga" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                <div>
                  <h5 className="font-medium text-primary text-xs mb-1">👤 Usuários e Permissões</h5>
                  <div className="border border-border rounded-md overflow-hidden">
                    <TableRow label="profiles" value="Perfis (name, email, avatar, birth_date)" />
                    <TableRow label="user_roles" value="Roles (admin, gerente, etc.)" />
                    <TableRow label="user_permissions" value="Permissões granulares" />
                    <TableRow label="user_additional_sectors" value="Setores adicionais" />
                    <TableRow label="user_presence" value="Online/offline (heartbeat)" />
                    <TableRow label="user_notifications" value="Notificações" />
                    <TableRow label="user_facial_data" value="Dados biométricos" />
                    <TableRow label="supervisor_team_members" value="Supervisor ↔ membros" />
                  </div>
                </div>
                <div>
                  <h5 className="font-medium text-primary text-xs mb-1">⚙️ Outros</h5>
                  <div className="border border-border rounded-md overflow-hidden">
                    <TableRow label="sectors" value="Setores com cor e ícone" />
                    <TableRow label="calendar_events" value="Reuniões, lembretes" />
                    <TableRow label="meeting_participants" value="Participantes com status" />
                    <TableRow label="attachments" value="Anexos de msgs e avisos" />
                    <TableRow label="audit_logs" value="Logs de auditoria" />
                    <TableRow label="system_settings" value="Configurações do sistema" />
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          </div>

          {/* 4. Auth */}
          <div id="doc-auth" className="scroll-mt-4">
            <CollapsibleSection title="4. Autenticação e Segurança" icon={Shield}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Métodos de Autenticação:</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>E-mail e Senha:</strong> Verificação de e-mail obrigatória</li>
                    <li><strong>Reconhecimento Facial:</strong> face-api.js (128-dim descriptors)</li>
                  </ul>
                  <h4 className="font-semibold mt-3 mb-1">Admin Principal:</h4>
                  <p className="text-xs text-muted-foreground">E-mail: <code className="bg-muted px-1 py-0.5 rounded text-xs">adminservchat@servsul.com.br</code></p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Níveis de Autonomia:</h4>
                  <div className="border border-border rounded-md overflow-hidden">
                    <TableRow label="admin" value="Acesso total ao sistema" />
                    <TableRow label="gerente" value="Gestão, avisos, quadros" />
                    <TableRow label="gestor" value="Similar ao gerente" />
                    <TableRow label="diretoria" value="Relatórios e gerenciamento" />
                    <TableRow label="supervisor" value="Gestão de equipe" />
                    <TableRow label="colaborador" value="Chat, avisos, tarefas" />
                  </div>
                </div>
              </div>
              <h4 className="font-semibold mt-3">Controle de Acesso:</h4>
              <CodeBlock>{`const { user, profile, isAdmin, canAccess, signOut } = useAuth();
canAccess('can_access_management') // boolean
isAdmin // verifica role 'admin' na tabela user_roles`}</CodeBlock>
            </CollapsibleSection>
          </div>

          {/* 5. Features */}
          <div id="doc-features" className="scroll-mt-4">
            <CollapsibleSection title="5. Funcionalidades do Sistema" icon={Layers}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <InfoCard icon={Home} title="Início" value="Dashboard com resumo: tarefas, aniversariantes, avisos, atividade" />
                <InfoCard icon={MessageSquare} title="Chat por Setores" value="Tempo real, menções @user/@card, formatação, DMs, grupos privados" />
                <InfoCard icon={Bell} title="Avisos Gerais" value="Prioridade, expiração, comentários, controle de leitura, anexos" />
                <InfoCard icon={Cake} title="Aniversariantes" value="Mural mensal com celebração animada (confetti)" />
                <InfoCard icon={ListTodo} title="Gestão de Tarefas" value="Kanban: múltiplos quadros, automações, templates, workflow, relatórios" />
                <InfoCard icon={Users} title="Gestão de Pessoas" value="Equipe do supervisor, analytics de produtividade" />
                <InfoCard icon={Settings} title="Gerenciamento" value="CRUD de usuários, roles, permissões, cadastro facial" />
                <InfoCard icon={Building2} title="Gestão de Setores" value="CRUD setores com ícones, cores e membros" />
                <InfoCard icon={Sparkles} title="Comunicados Importantes" value="Modal obrigatório, estilos customizáveis, agendamento" />
                <InfoCard icon={CalendarDays} title="Calendário" value="Eventos, reuniões com confirmação, links de reunião" />
                <InfoCard icon={Mail} title="Disparo de Feedback" value="E-mails mensais via Resend API" />
                <InfoCard icon={Trash2} title="Exclusão de Dados" value="Exclusão controlada com auditoria automática" />
                <InfoCard icon={FileText} title="Logs do Sistema" value="Audit logs com filtros (admin principal)" />
                <InfoCard icon={HardDrive} title="Armazenamento" value="Monitoramento de storage (admin principal)" />
              </div>
            </CollapsibleSection>
          </div>

          {/* 6. File Structure */}
          <div id="doc-file-structure" className="scroll-mt-4">
            <CollapsibleSection title="6. Estrutura de Arquivos" icon={FileText}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h5 className="font-medium text-primary text-xs mb-1">Frontend (src/)</h5>
                  <CodeBlock>{`src/
├── App.tsx             # Roteamento (React Router)
├── main.tsx            # Ponto de entrada
├── index.css           # Design tokens (HSL)
├── components/
│   ├── layout/         # Header, Sidebar, Mobile
│   ├── sections/       # 16 seções principais
│   ├── chat/           # Chat, DMs, Grupos
│   ├── tasks/          # Kanban, Relatórios
│   ├── ui/             # ~50 shadcn/ui
│   ├── user/           # Perfil, presença
│   └── pwa/            # Install, Offline
├── contexts/           # AuthContext
├── hooks/              # 30+ hooks
├── integrations/       # Supabase client
├── lib/                # Utilitários
└── pages/              # Auth, Index, 404`}</CodeBlock>
                </div>
                <div>
                  <h5 className="font-medium text-primary text-xs mb-1">Backend (supabase/)</h5>
                  <CodeBlock>{`supabase/
├── config.toml           # Config do projeto
└── functions/            # 12 Edge Functions
    ├── create-admin/
    ├── register-user/
    ├── register-facial-data/
    ├── facial-login/
    ├── get-facial-data/
    ├── get-public-sectors/
    ├── update-user-permissions/
    ├── delete-data/
    ├── send-announcement-email/
    ├── send-feedback-email/
    ├── process-automations/
    └── duplicate-scheduled-cards/`}</CodeBlock>
                  <h5 className="font-medium text-primary text-xs mb-1 mt-3">Público (public/)</h5>
                  <CodeBlock>{`public/
├── manifest.json    # PWA manifest
├── sw.js            # Service Worker
├── robots.txt       # SEO
└── icons/           # Ícones PWA`}</CodeBlock>
                </div>
              </div>
            </CollapsibleSection>
          </div>

          {/* 7. Hooks */}
          <div id="doc-hooks" className="scroll-mt-4">
            <CollapsibleSection title="7. Hooks Customizados" icon={Zap}>
              <p className="mb-2">O sistema utiliza <strong>30+ hooks</strong> para encapsular lógica de negócio:</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <div className="border border-border rounded-md overflow-hidden">
                  <TableRow label="useData" value="Carrega profiles, sectors, users" />
                  <TableRow label="useBoardTasks" value="CRUD tasks (create, move, archive)" />
                  <TableRow label="useTaskBoards" value="CRUD quadros, membros, colunas" />
                  <TableRow label="useSubtasks" value="Subtarefas e grupos hierárquicos" />
                  <TableRow label="useTaskLabels" value="Etiquetas coloridas" />
                  <TableRow label="useTaskAssignees" value="Múltiplos responsáveis" />
                  <TableRow label="useTaskActivities" value="Histórico de atividades" />
                  <TableRow label="useAutomationRules" value="Automações SE→ENTÃO" />
                  <TableRow label="useWorkflowRules" value="Regras de fluxo entre colunas" />
                  <TableRow label="useCardDuplications" value="Duplicação automática" />
                  <TableRow label="useColumnAutoSubtasks" value="Auto-subtarefas por coluna" />
                  <TableRow label="useWorkloadAlerts" value="Alertas de sobrecarga" />
                  <TableRow label="useDirectMessages" value="DMs com realtime" />
                  <TableRow label="usePrivateGroups" value="Grupos privados de chat" />
                  <TableRow label="useAnnouncements" value="CRUD avisos + comentários" />
                </div>
                <div className="border border-border rounded-md overflow-hidden">
                  <TableRow label="useImportantAnnouncements" value="Comunicados com modal" />
                  <TableRow label="useNotifications" value="Notificações + contadores" />
                  <TableRow label="usePresence" value="Online/offline (heartbeat)" />
                  <TableRow label="useTypingIndicator" value="Digitação no chat" />
                  <TableRow label="useFaceRecognition" value="Descritores faciais" />
                  <TableRow label="useFileUpload" value="Upload com progresso" />
                  <TableRow label="useSound" value="Sons de notificação" />
                  <TableRow label="usePWA" value="Instalação PWA" />
                  <TableRow label="useOnboarding" value="Onboarding novos usuários" />
                  <TableRow label="useBirthdayCelebration" value="Celebração aniversário" />
                  <TableRow label="useSectorManagement" value="CRUD setores" />
                  <TableRow label="useSupervisorTeam" value="Equipe supervisor" />
                  <TableRow label="useTeamAnalytics" value="Analytics produtividade" />
                  <TableRow label="useMeetingStatus" value="Status de reuniões" />
                  <TableRow label="useIsMobile" value="Detecção mobile/desktop" />
                </div>
              </div>
            </CollapsibleSection>
          </div>

          {/* 8. Edge Functions */}
          <div id="doc-edge-functions" className="scroll-mt-4">
            <CollapsibleSection title="8. Funções de Backend (Edge Functions)" icon={Server}>
              <p className="mb-2">Rodam em Deno runtime, deployadas automaticamente. Usam <code className="bg-muted px-1 rounded text-xs">SERVICE_ROLE_KEY</code>.</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <div className="border border-border rounded-md overflow-hidden">
                  <TableRow label="create-admin" value="Bootstrap do primeiro admin" />
                  <TableRow label="register-user" value="Cadastro + profile + permissions" />
                  <TableRow label="update-user-permissions" value="Permissões granulares" />
                  <TableRow label="register-facial-data" value="Salva descritores 128-dim" />
                  <TableRow label="facial-login" value="Compara descritores faciais" />
                  <TableRow label="get-facial-data" value="Consulta dados faciais" />
                </div>
                <div className="border border-border rounded-md overflow-hidden">
                  <TableRow label="get-public-sectors" value="Setores para tela pública" />
                  <TableRow label="delete-data" value="Exclusão + audit log" />
                  <TableRow label="send-announcement-email" value="E-mail de aviso (Resend)" />
                  <TableRow label="send-feedback-email" value="E-mail de feedback (Resend)" />
                  <TableRow label="process-automations" value="Motor de automações" />
                  <TableRow label="duplicate-scheduled-cards" value="Duplicação agendada" />
                </div>
              </div>
            </CollapsibleSection>
          </div>

          {/* 9-10-11-12 in grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 9. Storage */}
            <div id="doc-storage" className="scroll-mt-4">
              <CollapsibleSection title="9. Armazenamento (Storage)" icon={HardDrive}>
                <div className="border border-border rounded-md overflow-hidden">
                  <TableRow label="avatars (público)" value="Fotos de perfil (JPEG, PNG, WebP)" />
                  <TableRow label="attachments (público)" value="Anexos (PDF, DOC, XLS, ZIP, imagens)" />
                  <TableRow label="face-images (privado)" value="Imagens faciais (via Edge Functions)" />
                </div>
              </CollapsibleSection>
            </div>

            {/* 10. PWA */}
            <div id="doc-pwa" className="scroll-mt-4">
              <CollapsibleSection title="10. PWA e Responsividade" icon={Smartphone}>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li><strong>manifest.json:</strong> Nome, ícones, display standalone</li>
                  <li><strong>sw.js:</strong> Cache-first para assets</li>
                  <li><strong>InstallPrompt:</strong> Sugere instalação</li>
                  <li><strong>OfflineIndicator:</strong> Indicador sem conexão</li>
                  <li><strong>useIsMobile():</strong> Layout adaptativo</li>
                  <li>Sidebar no desktop, nav inferior no mobile</li>
                </ul>
              </CollapsibleSection>
            </div>
          </div>

          {/* 11. RLS */}
          <div id="doc-rls" className="scroll-mt-4">
            <CollapsibleSection title="11. Políticas de Segurança (RLS)" icon={Lock}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-xs mb-1">Funções Auxiliares:</h4>
                  <div className="border border-border rounded-md overflow-hidden">
                    <TableRow label="is_admin()" value="Verifica role admin" />
                    <TableRow label="has_role()" value="Verifica role específica" />
                    <TableRow label="has_autonomy_level()" value="Hierarquia de autonomia" />
                    <TableRow label="is_board_member()" value="Membro do quadro" />
                    <TableRow label="is_board_owner()" value="Dono do quadro" />
                    <TableRow label="is_group_member()" value="Membro do grupo" />
                    <TableRow label="get_current_profile_id()" value="Profile.id atual" />
                    <TableRow label="user_has_sector_access()" value="Acesso ao setor" />
                    <TableRow label="check_user_is_active()" value="Perfil ativo" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-xs mb-1">Padrões de Acesso:</h4>
                  <ul className="list-disc pl-5 space-y-1 text-xs">
                    <li><strong>Msgs setor:</strong> Apenas setores do usuário</li>
                    <li><strong>DMs:</strong> Remetente e destinatário</li>
                    <li><strong>Quadros:</strong> Apenas membros</li>
                    <li><strong>Grupos:</strong> Apenas membros do grupo</li>
                    <li><strong>Admin:</strong> audit_logs, facial_data, settings restritos</li>
                  </ul>
                </div>
              </div>
            </CollapsibleSection>
          </div>

          {/* 12. Realtime */}
          <div id="doc-realtime" className="scroll-mt-4">
            <CollapsibleSection title="12. Funcionalidades em Tempo Real" icon={Zap}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <InfoCard icon={MessageSquare} title="Chat por Setor" value="Mensagens instantâneas para membros" />
                <InfoCard icon={Mail} title="DMs" value="Sincronizadas em tempo real" />
                <InfoCard icon={Users} title="Grupos Privados" value="Msgs para todos os membros" />
                <InfoCard icon={ListTodo} title="Quadros" value="Cards refletidos instantaneamente" />
                <InfoCard icon={Bell} title="Avisos" value="Novos avisos para todos" />
                <InfoCard icon={Eye} title="Presença" value="Online/offline via heartbeat" />
              </div>
              <h4 className="font-semibold mt-3 text-xs">Padrão de Implementação:</h4>
              <CodeBlock>{`const channel = supabase
  .channel(\`board-tasks-\${boardId}\`)
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'tasks',
    filter: \`board_id=eq.\${boardId}\`
  }, () => fetchTasks())
  .subscribe();`}</CodeBlock>
            </CollapsibleSection>
          </div>

          {/* Footer */}
          <div className="text-center pt-6 pb-4 border-t border-border text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-center gap-2">
              <img src={logoServsul} alt="Servsul" className="h-6 w-6 object-contain rounded" />
              <img src={appLogo} alt="ServChat" className="h-6 w-6 object-contain rounded" />
            </div>
            <p><strong>ServChat</strong> — Plataforma de Comunicação Interna • Grupo Servsul</p>
            <p>Desenvolvido com React, TypeScript, Tailwind CSS e Lovable Cloud</p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
