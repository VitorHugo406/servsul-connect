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
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 25;

  const BLUE = [37, 99, 235] as const;
  const DARK = [15, 23, 42] as const;
  const GRAY = [100, 116, 139] as const;
  const LIGHT_BG = [248, 250, 252] as const;
  const WHITE = [255, 255, 255] as const;

  const addPage = () => { doc.addPage(); y = 25; };
  const checkPage = (needed: number) => { if (y + needed > pageH - 25) addPage(); };

  // Decorative header bar on every page
  const drawPageDecoration = () => {
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, pageW, 4, 'F');
    doc.setFillColor(241, 245, 249);
    doc.rect(0, pageH - 12, pageW, 12, 'F');
  };

  const sectionTitle = (num: string, text: string) => {
    checkPage(18);
    // Blue accent bar
    doc.setFillColor(...BLUE);
    doc.roundedRect(margin, y - 4, contentW, 12, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text(`${num}  ${text}`, margin + 5, y + 3.5);
    y += 14;
    doc.setTextColor(...DARK);
  };

  const subTitle = (text: string) => {
    checkPage(10);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, y - 3, contentW, 8, 1, 1, 'F');
    doc.setFontSize(9);
    doc.setTextColor(...BLUE);
    doc.text(text, margin + 4, y + 2);
    y += 9;
    doc.setTextColor(...DARK);
  };

  const bodyText = (text: string) => {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    const lines = doc.splitTextToSize(text, contentW);
    checkPage(lines.length * 4.2 + 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.2 + 3;
  };

  const bulletList = (items: string[]) => {
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    items.forEach(item => {
      checkPage(5);
      doc.setFillColor(...BLUE);
      doc.circle(margin + 2, y - 1, 0.8, 'F');
      const lines = doc.splitTextToSize(item, contentW - 8);
      doc.text(lines, margin + 6, y);
      y += lines.length * 4 + 1.5;
    });
    y += 2;
  };

  const addTable = (head: string[][], body: string[][], colWidths?: number[]) => {
    checkPage(15);
    const opts: any = {
      startY: y,
      head,
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, lineColor: [226, 232, 240], lineWidth: 0.2 },
      headStyles: { fillColor: [...DARK], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [...LIGHT_BG] },
      bodyStyles: { textColor: [51, 65, 85] },
      theme: 'grid',
      tableLineColor: [226, 232, 240],
      tableLineWidth: 0.2,
    };
    if (colWidths) opts.columnStyles = colWidths.reduce((acc: any, w, i) => { acc[i] = { cellWidth: w }; return acc; }, {});
    autoTable(doc, opts);
    y = (doc as any).lastAutoTable.finalY + 6;
  };

  // =============================================
  // COVER PAGE
  // =============================================
  drawPageDecoration();
  
  // Large decorative circle
  doc.setFillColor(239, 246, 255);
  doc.circle(pageW / 2, 85, 40, 'F');
  doc.setFillColor(219, 234, 254);
  doc.circle(pageW / 2, 85, 28, 'F');
  doc.setFillColor(...BLUE);
  doc.circle(pageW / 2, 85, 16, 'F');

  // Icon-like text inside circle
  doc.setFontSize(18);
  doc.setTextColor(...WHITE);
  doc.text('SC', pageW / 2, 89, { align: 'center' });

  doc.setFontSize(32);
  doc.setTextColor(...DARK);
  doc.text('ServChat', pageW / 2, 135, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(...GRAY);
  doc.text('Documentação Técnica Completa', pageW / 2, 145, { align: 'center' });

  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.8);
  doc.line(pageW / 2 - 30, 152, pageW / 2 + 30, 152);

  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text('Plataforma de Comunicação Interna', pageW / 2, 162, { align: 'center' });
  doc.text('Grupo Servsul', pageW / 2, 170, { align: 'center' });

  // Tech badges
  const techs = ['React 18', 'TypeScript', 'Tailwind CSS', 'PostgreSQL', 'Vite', 'PWA'];
  const badgeY = 185;
  const badgeW = 24;
  const totalBadgesW = techs.length * badgeW + (techs.length - 1) * 3;
  let badgeX = (pageW - totalBadgesW) / 2;
  techs.forEach(tech => {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(badgeX, badgeY, badgeW, 7, 2, 2, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(...BLUE);
    doc.text(tech, badgeX + badgeW / 2, badgeY + 4.5, { align: 'center' });
    badgeX += badgeW + 3;
  });

  // Info cards at bottom
  const cardY = 210;
  const cardW = (contentW - 6) / 3;
  const cardData = [
    { label: 'Tabelas', value: '35+' },
    { label: 'Hooks', value: '30+' },
    { label: 'Edge Functions', value: '12' },
  ];
  cardData.forEach((card, i) => {
    const cx = margin + i * (cardW + 3);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(cx, cardY, cardW, 18, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, cardY, cardW, 18, 2, 2, 'S');
    doc.setFontSize(16);
    doc.setTextColor(...BLUE);
    doc.text(card.value, cx + cardW / 2, cardY + 9, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(card.label, cx + cardW / 2, cardY + 14.5, { align: 'center' });
  });

  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, pageW / 2, pageH - 18, { align: 'center' });

  // =============================================
  // TABLE OF CONTENTS
  // =============================================
  addPage();
  drawPageDecoration();
  y = 20;
  doc.setFillColor(...BLUE);
  doc.roundedRect(margin, y - 4, contentW, 12, 2, 2, 'F');
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text('Índice', margin + 5, y + 3.5);
  y += 18;

  const tocItems = [
    { num: '01', title: 'Visão Geral do Sistema' },
    { num: '02', title: 'Stack Tecnológica' },
    { num: '03', title: 'Banco de Dados (PostgreSQL)' },
    { num: '04', title: 'Autenticação e Segurança' },
    { num: '05', title: 'Funcionalidades do Sistema' },
    { num: '06', title: 'Estrutura de Arquivos' },
    { num: '07', title: 'Hooks Customizados' },
    { num: '08', title: 'Funções de Backend (Edge Functions)' },
    { num: '09', title: 'Armazenamento de Arquivos' },
    { num: '10', title: 'PWA e Responsividade' },
    { num: '11', title: 'Políticas de Segurança (RLS)' },
    { num: '12', title: 'Funcionalidades em Tempo Real' },
  ];
  tocItems.forEach(item => {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y - 4, contentW, 10, 1.5, 1.5, 'F');
    doc.setFontSize(10);
    doc.setTextColor(...BLUE);
    doc.text(item.num, margin + 5, y + 2.5);
    doc.setTextColor(...DARK);
    doc.text(item.title, margin + 16, y + 2.5);
    // Dotted line
    doc.setDrawColor(200, 210, 220);
    doc.setLineDashPattern([0.5, 1.5], 0);
    const textW = doc.getTextWidth(item.title);
    doc.line(margin + 17 + textW, y + 2.5, pageW - margin - 5, y + 2.5);
    doc.setLineDashPattern([], 0);
    y += 12;
  });

  // =============================================
  // 1. VISÃO GERAL
  // =============================================
  addPage();
  drawPageDecoration();
  sectionTitle('01', 'Visão Geral do Sistema');
  bodyText('O ServChat é uma plataforma web interna desenvolvida para o Grupo Servsul, focada em comunicação corporativa, gestão de tarefas e colaboração entre setores. O sistema foi projetado para centralizar toda a comunicação interna, substituindo ferramentas fragmentadas.');
  
  y += 2;
  subTitle('Principais Objetivos');
  bulletList([
    'Centralizar a comunicação interna entre setores da empresa',
    'Gerenciar tarefas com quadros estilo Kanban',
    'Publicar avisos e comunicados oficiais com controle de leitura',
    'Mural de aniversariantes e eventos sazonais',
    'Controle de acesso por níveis de autonomia (admin, gerente, gestor, diretoria, supervisor, colaborador)',
    'Reconhecimento facial para autenticação biométrica',
    'Calendário integrado com reuniões e lembretes',
    'Disparo de e-mails de feedback via Resend API',
  ]);

  // =============================================
  // 2. STACK
  // =============================================
  sectionTitle('02', 'Stack Tecnológica');
  subTitle('Frontend');
  addTable(
    [['Tecnologia', 'Descrição']],
    [
      ['TypeScript', 'Tipagem estática sobre JavaScript'],
      ['React 18.3', 'Biblioteca de interfaces declarativas com hooks'],
      ['Vite', 'Bundler ultrarrápido com Hot Module Replacement'],
      ['Tailwind CSS 4', 'Framework CSS utility-first com design tokens HSL'],
      ['shadcn/ui', 'Componentes Radix UI com estilização Tailwind'],
      ['Framer Motion', 'Animações e transições declarativas'],
      ['React Router DOM v6', 'Roteamento SPA com layouts aninhados'],
      ['React Hook Form + Zod', 'Formulários com validação de schemas tipada'],
      ['Recharts', 'Gráficos SVG responsivos para dashboards'],
      ['Lucide React', 'Biblioteca de ícones SVG tree-shakable'],
      ['jsPDF + autotable', 'Geração de relatórios PDF no client-side'],
      ['xlsx', 'Leitura e escrita de planilhas Excel'],
      ['face-api.js', 'Reconhecimento facial em browser (TensorFlow.js)'],
    ],
    [55, contentW - 55]
  );

  subTitle('Backend (Lovable Cloud)');
  addTable(
    [['Tecnologia', 'Descrição']],
    [
      ['PostgreSQL', 'Banco relacional com suporte a JSON, arrays e full-text search'],
      ['Supabase Auth', 'Autenticação via JWT com email/senha e login facial'],
      ['PostgREST', 'API REST gerada automaticamente a partir do schema'],
      ['Supabase Realtime', 'Sincronização via WebSockets (postgres_changes)'],
      ['Edge Functions (Deno)', '12 funções serverless para lógica de backend'],
      ['Supabase Storage', 'Armazenamento de arquivos em 3 buckets'],
      ['Resend API', 'Envio de e-mails transacionais (avisos e feedback)'],
      ['Row Level Security', 'Controle de acesso granular em todas as tabelas'],
    ],
    [55, contentW - 55]
  );

  // =============================================
  // 3. DATABASE
  // =============================================
  sectionTitle('03', 'Banco de Dados (PostgreSQL)');
  bodyText('O banco de dados contém 35+ tabelas organizadas por domínio funcional. Todas possuem Row Level Security (RLS) ativado para controle de acesso granular.');

  subTitle('💬  Comunicação');
  addTable([['Tabela', 'Campos Principais', 'Descrição']], [
    ['messages', 'author_id, sector_id, content', 'Mensagens do chat por setor'],
    ['direct_messages', 'sender_id, receiver_id, is_read', 'Mensagens diretas entre usuários'],
    ['private_groups', 'name, avatar_url, created_by', 'Grupos privados de chat'],
    ['private_group_messages', 'group_id, sender_id, content', 'Mensagens dentro dos grupos'],
    ['private_group_members', 'group_id, profile_id, role', 'Membros com roles (admin/member)'],
    ['private_group_message_reads', 'group_id, last_read_at', 'Controle de última leitura'],
  ], [38, 48, contentW - 86]);

  subTitle('📢  Avisos e Comunicados');
  addTable([['Tabela', 'Campos Principais', 'Descrição']], [
    ['announcements', 'title, priority, is_pinned, expire_at', 'Avisos gerais com prioridade e expiração'],
    ['announcement_comments', 'announcement_id, author_id', 'Comentários nos avisos'],
    ['announcement_reads', 'announcement_id, user_id', 'Registro de leitura por usuário'],
    ['important_announcements', 'title, border_style, is_active', 'Comunicados com modal obrigatório'],
    ['important_announcement_reads', 'announcement_id, user_id', 'Controle de leitura'],
  ], [42, 50, contentW - 92]);

  subTitle('📋  Gestão de Tarefas (Kanban)');
  addTable([['Tabela', 'Descrição']], [
    ['task_boards', 'Quadros Kanban com nome, descrição, background e limiar de sobrecarga'],
    ['task_board_columns', 'Colunas com cor, posição, auto_assign, auto_cover, is_conclusion, is_template'],
    ['task_board_members', 'Membros do quadro com roles: owner, admin, member'],
    ['tasks', 'Cards com título, descrição, status, prioridade, responsável, data limite, capa, posição'],
    ['task_subtasks', 'Subtarefas com grupo opcional e posição ordenável'],
    ['subtask_groups', 'Grupos hierárquicos de subtarefas dentro de um card'],
    ['task_comments', 'Comentários dentro dos cards com autor e timestamp'],
    ['task_activities', 'Log de atividades: movimentação, edição, criação, exclusão'],
    ['task_labels', 'Etiquetas coloridas por quadro (nome + cor hex)'],
    ['task_label_assignments', 'Associação N:N entre etiquetas e tasks'],
    ['task_assignees', 'Múltiplos responsáveis por card (N:N com profiles)'],
    ['task_auto_duplications', 'Regras de cópia automática: diária, semanal, mensal'],
    ['task_automation_rules', 'Motor SE→ENTÃO (trigger_type + action_type + configs JSON)'],
    ['column_auto_subtasks', 'Subtarefas criadas automaticamente ao mover cards para coluna'],
    ['column_workflow_rules', 'Regras de bloqueio de movimentação entre colunas'],
    ['board_share_links', 'Links de compartilhamento com token único'],
    ['board_join_requests', 'Solicitações de entrada com status (pending/approved/rejected)'],
    ['workload_alerts', 'Alertas quando responsável excede limiar de tarefas'],
  ], [42, contentW - 42]);

  subTitle('👤  Usuários e Permissões');
  addTable([['Tabela', 'Descrição']], [
    ['profiles', 'Perfil completo: nome, email, avatar, nascimento, setor, nível de autonomia, status'],
    ['user_roles', 'Roles do sistema (enum: admin, gerente, supervisor, colaborador, gestor, diretoria)'],
    ['user_permissions', 'Permissões: post_announcements, delete_messages, access_management, password_change'],
    ['user_additional_sectors', 'Setores extras vinculados ao usuário (além do primário)'],
    ['user_presence', 'Status online/offline com heartbeat periódico (30s)'],
    ['user_notifications', 'Notificações: menções, avisos, tarefas, convites'],
    ['user_facial_data', 'Descritores faciais 128-dim para login biométrico'],
    ['supervisor_team_members', 'Vínculo supervisor ↔ membros da equipe'],
  ], [42, contentW - 42]);

  subTitle('⚙️  Infraestrutura');
  addTable([['Tabela', 'Descrição']], [
    ['sectors', 'Departamentos da empresa com nome, cor e ícone customizável'],
    ['calendar_events', 'Reuniões, lembretes e prazos com link de videoconferência'],
    ['meeting_participants', 'Participantes com status: pendente, aceito, recusado'],
    ['attachments', 'Anexos de mensagens, DMs e avisos (PDF, DOC, imagens, etc.)'],
    ['audit_logs', 'Registros de auditoria com IP, ação, tabela e dados do registro'],
    ['system_settings', 'Configurações globais do sistema (key-value)'],
  ], [42, contentW - 42]);

  // =============================================
  // 4. AUTH
  // =============================================
  sectionTitle('04', 'Autenticação e Segurança');
  
  subTitle('Métodos de Login');
  bulletList([
    'E-mail e Senha — Cadastro via formulário com verificação de e-mail obrigatória antes do primeiro acesso',
    'Reconhecimento Facial — Login biométrico usando face-api.js com descritores 128-dimensionais armazenados no banco e comparados via Edge Function (threshold de distância euclidiana)',
  ]);

  subTitle('Hierarquia de Autonomia (Enum app_role)');
  addTable([['Nível', 'Acesso', 'Descrição']], [
    ['admin', 'Total', 'Gerenciamento completo de usuários, configurações, logs e dados'],
    ['gerente', 'Amplo', 'Gestão de equipes, avisos, quadros de tarefas e relatórios'],
    ['gestor', 'Amplo', 'Similar ao gerente com foco em gestão operacional'],
    ['diretoria', 'Estratégico', 'Visualização de relatórios, dashboards e gestão'],
    ['supervisor', 'Equipe', 'Gestão da própria equipe e visibilidade de tarefas atribuídas'],
    ['colaborador', 'Básico', 'Chat, avisos, tarefas atribuídas e perfil pessoal'],
  ], [25, 25, contentW - 50]);

  bodyText('Admin Principal: Identificado pelo e-mail adminservchat@servsul.com.br — possui acesso exclusivo a Logs do Sistema, Monitoramento de Armazenamento e Documentação Técnica.');

  // =============================================
  // 5. FEATURES
  // =============================================
  sectionTitle('05', 'Funcionalidades do Sistema');
  addTable([['Módulo', 'Arquivo', 'Recursos']], [
    ['🏠 Início', 'HomeSection.tsx', 'Dashboard: resumo de tarefas, aniversariantes, avisos, atividade recente, links rápidos'],
    ['💬 Chat por Setores', 'ChatSection.tsx', 'Tempo real, menções @user/@card, formatação (negrito/itálico), DMs, grupos privados'],
    ['📢 Avisos Gerais', 'AnnouncementsSection.tsx', 'Prioridades, expiração, agendamento, comentários, controle de leitura, anexos'],
    ['🎂 Aniversariantes', 'BirthdaysSection.tsx', 'Mural mensal, celebração com confetti, modal no dia do aniversário'],
    ['📋 Gestão de Tarefas', 'TaskBoardSection.tsx', 'Kanban: quadros, colunas, cards, subtarefas, etiquetas, automações, templates, workflow, drag-and-drop, relatórios, alertas de sobrecarga, duplicação automática'],
    ['👥 Gestão de Pessoas', 'PeopleManagementSection.tsx', 'Equipe do supervisor, analytics de produtividade, vinculação de membros'],
    ['⚙️ Gerenciamento', 'ManagementSection.tsx', 'CRUD usuários, roles, permissões, cadastro facial, dados do perfil'],
    ['🏢 Gestão de Setores', 'SectorManagementSection.tsx', 'CRUD setores com ícones e cores, membros por setor, setores adicionais'],
    ['⭐ Comunicados', 'ImportantAnnouncementsSection.tsx', 'Modal obrigatório, estilos de borda, agendamento, controle de leitura'],
    ['📅 Calendário', 'CalendarSection.tsx', 'Eventos, reuniões com confirmação, links de reunião, participantes'],
    ['📧 Feedback', 'FeedbackEmailSection.tsx', 'Disparo de e-mails mensais via Resend API com templates'],
    ['🗑️ Exclusão de Dados', 'DataManagementSection.tsx', 'Exclusão controlada com auditoria automática em audit_logs'],
    ['📄 Logs do Sistema', 'LogsSection.tsx', 'Audit logs com filtros por ação, tabela, data, usuário (admin)'],
    ['💾 Armazenamento', 'StorageMonitoringSection.tsx', 'Monitoramento de buckets e uso de espaço (admin)'],
    ['🎉 Eventos Mensais', 'EventHistorySection.tsx', 'Histórico de campanhas e eventos sazonais com efeitos visuais'],
  ], [30, 42, contentW - 72]);

  // =============================================
  // 6. FILE STRUCTURE
  // =============================================
  sectionTitle('06', 'Estrutura de Arquivos');
  
  subTitle('📁  Diretório Principal (src/)');
  addTable([['Pasta / Arquivo', 'Tipo', 'Descrição']], [
    ['App.tsx', 'Componente', 'Roteamento principal com React Router (rotas: /, /auth, /*)'],
    ['main.tsx', 'Entry Point', 'Ponto de entrada: monta React no DOM com providers'],
    ['index.css', 'Estilos', 'Design tokens CSS com variáveis HSL para tema claro/escuro'],
    ['components/layout/', 'Diretório', 'Header, Sidebar, MobileHeader, MobileNavigation, NotificationPanel'],
    ['components/sections/', 'Diretório', '16 seções/páginas principais (Home, Chat, Tasks, etc.)'],
    ['components/chat/', 'Diretório', 'ChatInput, ChatMessage, DM, Grupos, Mentions, TypingIndicator'],
    ['components/tasks/', 'Diretório', 'TaskDetailDialog, ReportDialog, AutomationRules, Filters, Constants'],
    ['components/ui/', 'Diretório', '~50 componentes shadcn/ui (Button, Dialog, Card, Table, etc.)'],
    ['components/user/', 'Diretório', 'UserProfileDialog, PresenceIndicator, UserStatusSelector'],
    ['components/pwa/', 'Diretório', 'InstallPrompt e OfflineIndicator para PWA'],
    ['components/birthday/', 'Diretório', 'BirthdayCelebrationModal com animação de confetti'],
    ['components/announcements/', 'Diretório', 'ImportantAnnouncementModal com estilos de borda'],
    ['components/chatbot/', 'Diretório', 'ChatbotWidget para assistente inteligente'],
    ['components/facial/', 'Diretório', 'FacialCamera e FacialLoginCamera para biometria'],
    ['components/onboarding/', 'Diretório', 'OnboardingScreen para novos usuários'],
    ['contexts/', 'Diretório', 'AuthContext.tsx — contexto global de autenticação'],
    ['hooks/', 'Diretório', '30+ hooks customizados para lógica de negócio'],
    ['integrations/supabase/', 'Diretório', 'client.ts e types.ts (gerados automaticamente)'],
    ['lib/', 'Diretório', 'utils.ts (cn helper) e chatFormatUtils.tsx (formatação de msgs)'],
    ['pages/', 'Diretório', 'Auth.tsx (login), Index.tsx (app principal), NotFound.tsx (404)'],
  ], [38, 22, contentW - 60]);

  subTitle('📁  Backend (supabase/)');
  addTable([['Pasta / Arquivo', 'Tipo', 'Descrição']], [
    ['config.toml', 'Config', 'Configuração do projeto Supabase (auto-gerenciado)'],
    ['functions/create-admin/', 'Edge Fn', 'Bootstrap: cria primeiro admin do sistema'],
    ['functions/register-user/', 'Edge Fn', 'Cadastro de usuário + profile + permissions'],
    ['functions/register-facial-data/', 'Edge Fn', 'Salva descritores faciais 128-dim no banco'],
    ['functions/facial-login/', 'Edge Fn', 'Compara descritores para login biométrico'],
    ['functions/get-facial-data/', 'Edge Fn', 'Consulta dados faciais de um usuário'],
    ['functions/get-public-sectors/', 'Edge Fn', 'Retorna setores para tela pública de login'],
    ['functions/update-user-permissions/', 'Edge Fn', 'Atualiza permissões granulares do usuário'],
    ['functions/delete-data/', 'Edge Fn', 'Exclusão controlada com registro em audit_logs'],
    ['functions/send-announcement-email/', 'Edge Fn', 'Disparo de e-mail de aviso via Resend API'],
    ['functions/send-feedback-email/', 'Edge Fn', 'Disparo de e-mail de feedback via Resend API'],
    ['functions/process-automations/', 'Edge Fn', 'Executa regras SE→ENTÃO nos quadros Kanban'],
    ['functions/duplicate-scheduled-cards/', 'Edge Fn', 'Duplica cards agendados (diário/semanal/mensal)'],
  ], [48, 18, contentW - 66]);

  subTitle('📁  Público (public/)');
  addTable([['Arquivo', 'Descrição']], [
    ['manifest.json', 'PWA manifest: nome, ícones, cores, display standalone'],
    ['sw.js', 'Service Worker com estratégia cache-first para assets estáticos'],
    ['robots.txt', 'Configuração SEO para crawlers'],
    ['icons/', 'Ícones PWA em múltiplos tamanhos (192px, 512px, maskable)'],
  ], [35, contentW - 35]);

  // =============================================
  // 7. HOOKS
  // =============================================
  sectionTitle('07', 'Hooks Customizados');
  bodyText('O sistema utiliza 30+ hooks React customizados para encapsular toda a lógica de negócio, acesso ao banco e estado local:');

  subTitle('📋  Tarefas e Quadros');
  addTable([['Hook', 'Descrição']], [
    ['useBoardTasks', 'CRUD completo de tasks: criar, editar, mover, reordenar, arquivar, deletar'],
    ['useTaskBoards', 'CRUD de quadros Kanban, membros, colunas com posições'],
    ['useSubtasks / useSubtaskGroups', 'Gerenciamento de subtarefas e grupos hierárquicos'],
    ['useTaskLabels', 'CRUD de etiquetas coloridas e atribuição N:N a tasks'],
    ['useTaskAssignees', 'Múltiplos responsáveis por card'],
    ['useTaskActivities', 'Registro e consulta do histórico de ações em cards'],
    ['useAutomationRules', 'Motor de automações SE→ENTÃO com config JSON'],
    ['useWorkflowRules', 'Regras de bloqueio entre colunas'],
    ['useCardDuplications', 'Regras de duplicação automática periódica'],
    ['useColumnAutoSubtasks', 'Subtarefas geradas automaticamente por coluna'],
    ['useWorkloadAlerts', 'Alertas quando responsável está sobrecarregado'],
  ], [42, contentW - 42]);

  subTitle('💬  Comunicação');
  addTable([['Hook', 'Descrição']], [
    ['useDirectMessages', 'Mensagens diretas com sincronização realtime'],
    ['usePrivateGroups', 'CRUD de grupos privados com membros e mensagens'],
    ['useAnnouncements', 'CRUD de avisos com comentários, leitura e anexos'],
    ['useImportantAnnouncements', 'Comunicados importantes com modal obrigatório'],
    ['useNotifications', 'Sistema de notificações com contadores não-lidos'],
    ['useTypingIndicator', 'Indicador "está digitando..." no chat'],
  ], [42, contentW - 42]);

  subTitle('👤  Usuário e Sistema');
  addTable([['Hook', 'Descrição']], [
    ['useData', 'Hook principal: carrega profiles, sectors e users ativos'],
    ['usePresence', 'Status online/offline com heartbeat a cada 30s'],
    ['useFaceRecognition', 'Captura e comparação de descritores faciais via face-api.js'],
    ['useFileUpload', 'Upload para Storage com progresso e validação de tipo/tamanho'],
    ['useSound', 'Reprodução de sons de notificação (new_message, mention)'],
    ['usePWA', 'Detecção de instalação PWA e prompt de install'],
    ['useOnboarding', 'Fluxo de boas-vindas para novos usuários'],
    ['useBirthdayCelebration', 'Detecção de aniversário e trigger de celebração'],
    ['useSectorManagement', 'CRUD de setores com ícones e cores'],
    ['useSupervisorTeam', 'Gestão da equipe vinculada ao supervisor'],
    ['useTeamAnalytics', 'Analytics de produtividade por membro da equipe'],
    ['useMeetingStatus', 'Detecta reuniões ativas e altera status automaticamente'],
  ], [42, contentW - 42]);

  // =============================================
  // 8. EDGE FUNCTIONS
  // =============================================
  sectionTitle('08', 'Funções de Backend (Edge Functions)');
  bodyText('As 12 Edge Functions rodam em Deno runtime e são deployadas automaticamente. Utilizam SUPABASE_SERVICE_ROLE_KEY para operações privilegiadas que contornam RLS.');
  addTable([['Função', 'Método', 'Descrição']], [
    ['create-admin', 'POST', 'Cria o primeiro admin do sistema (bootstrap inicial)'],
    ['register-user', 'POST', 'Registra usuário via auth.admin.createUser() + profile + permissions'],
    ['update-user-permissions', 'POST', 'Atualiza flags de permissão na tabela user_permissions'],
    ['register-facial-data', 'POST', 'Salva descritores faciais (Float32Array 128-dim) + imagem'],
    ['facial-login', 'POST', 'Compara descritores enviados com cadastrados (distância < 0.6)'],
    ['get-facial-data', 'POST', 'Retorna descritores e imagem facial de um usuário'],
    ['get-public-sectors', 'GET', 'Retorna lista de setores para exibição na tela de login'],
    ['delete-data', 'POST', 'Exclusão controlada de registros com log em audit_logs'],
    ['send-announcement-email', 'POST', 'Envia e-mail de aviso para todos os usuários ativos via Resend'],
    ['send-feedback-email', 'POST', 'Envia e-mail de feedback personalizado para um usuário via Resend'],
    ['process-automations', 'POST', 'Executa regras de automação do quadro ao mover cards'],
    ['duplicate-scheduled-cards', 'POST', 'Duplica cards com subtarefas conforme agendamento (cron)'],
  ], [42, 14, contentW - 56]);

  // =============================================
  // 9. STORAGE
  // =============================================
  sectionTitle('09', 'Armazenamento de Arquivos (Storage)');
  addTable([['Bucket', 'Acesso', 'Tipos Aceitos', 'Uso']], [
    ['avatars', 'Público', 'JPEG, PNG, WebP', 'Fotos de perfil dos usuários'],
    ['attachments', 'Público', 'PDF, DOC, DOCX, XLS, XLSX, ZIP, imagens', 'Anexos de mensagens, DMs e avisos'],
    ['face-images', 'Privado', 'JPEG, PNG', 'Imagens faciais (acesso exclusivo via Edge Functions)'],
  ], [28, 18, 48, contentW - 94]);

  // =============================================
  // 10. PWA
  // =============================================
  sectionTitle('10', 'PWA e Responsividade');
  subTitle('Progressive Web App');
  bulletList([
    'manifest.json — Nome da aplicação, ícones em 3 tamanhos, cores do tema, display standalone',
    'sw.js — Service Worker com estratégia cache-first para assets estáticos e fallback offline',
    'InstallPrompt — Componente que detecta disponibilidade de instalação e exibe prompt',
    'OfflineIndicator — Banner visual que aparece automaticamente quando sem conexão',
  ]);
  subTitle('Layout Responsivo');
  bulletList([
    'useIsMobile() hook com breakpoint em 768px para detecção de dispositivo',
    'Desktop: Sidebar colapsável à esquerda + Header com busca global e notificações',
    'Mobile: Header compacto + Navegação inferior com ícones das principais seções',
    'Quadro Kanban: scroll horizontal no mobile, colunas compactadas e touch-friendly',
  ]);

  // =============================================
  // 11. RLS
  // =============================================
  sectionTitle('11', 'Políticas de Segurança (RLS)');
  bodyText('Todas as 35+ tabelas possuem Row Level Security (RLS) ativado. As políticas utilizam funções auxiliares SECURITY DEFINER para evitar recursão:');
  addTable([['Função SQL', 'Retorno', 'Descrição']], [
    ['is_admin()', 'boolean', 'Verifica se o usuário possui role admin'],
    ['has_role(_user_id, _role)', 'boolean', 'Verifica se um usuário possui role específica'],
    ['has_autonomy_level(level)', 'boolean', 'Verifica hierarquia: admin > gerente > supervisor > colaborador'],
    ['is_board_member(board_id)', 'boolean', 'Verifica se é membro ou dono do quadro Kanban'],
    ['is_board_owner(board_id)', 'boolean', 'Verifica se é dono (criador) do quadro'],
    ['is_board_admin_or_owner(board_id)', 'boolean', 'Verifica se é admin ou dono do quadro'],
    ['is_group_member(group_id)', 'boolean', 'Verifica se é membro de um grupo privado'],
    ['is_group_admin(group_id)', 'boolean', 'Verifica se é admin de um grupo privado'],
    ['get_current_profile_id()', 'uuid', 'Retorna o profile.id do usuário autenticado'],
    ['get_current_sector_id()', 'uuid', 'Retorna o sector_id do perfil do usuário'],
    ['user_has_sector_access()', 'boolean', 'Verifica acesso: setor primário + adicionais + "Geral"'],
    ['check_user_is_active()', 'boolean', 'Verifica se o perfil do usuário está ativo (is_active)'],
  ], [42, 18, contentW - 60]);

  subTitle('Padrões de Acesso por Domínio');
  bulletList([
    'Mensagens de setor: usuários só acessam mensagens dos seus setores (primário + adicionais + "Geral")',
    'DMs: apenas remetente e destinatário podem visualizar e enviar',
    'Quadros Kanban: apenas membros do quadro acessam tasks, colunas e configurações',
    'Grupos privados: apenas membros do grupo visualizam e enviam mensagens',
    'Dados administrativos: audit_logs, user_facial_data, system_settings acessíveis apenas por admins',
  ]);

  // =============================================
  // 12. REALTIME
  // =============================================
  sectionTitle('12', 'Funcionalidades em Tempo Real');
  bodyText('O sistema utiliza Supabase Realtime (WebSockets) para sincronizar dados instantaneamente entre todos os clientes conectados:');
  addTable([['Recurso', 'Tabela', 'Eventos', 'Descrição']], [
    ['Chat por Setor', 'messages', 'INSERT', 'Novas mensagens aparecem instantaneamente'],
    ['Mensagens Diretas', 'direct_messages', 'INSERT, UPDATE', 'DMs sincronizadas + status de leitura'],
    ['Grupos Privados', 'private_group_messages', 'INSERT', 'Mensagens para todos os membros do grupo'],
    ['Cards de Tarefas', 'tasks', 'INSERT, UPDATE, DELETE', 'Movimentação e edição em tempo real'],
    ['Colunas do Quadro', 'task_board_columns', '*', 'Adição, remoção e reordenação de colunas'],
    ['Subtarefas', 'task_subtasks', '*', 'Check/uncheck refletido instantaneamente'],
    ['Avisos', 'announcements', 'INSERT', 'Novos avisos para todos os usuários'],
    ['Notificações', 'user_notifications', 'INSERT', 'Alertas push em tempo real'],
    ['Presença', 'user_presence', 'UPDATE', 'Status online/offline via heartbeat 30s'],
  ], [32, 38, 28, contentW - 98]);

  // =============================================
  // FINAL FOOTER
  // =============================================
  checkPage(25);
  y += 8;
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text('ServChat', pageW / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Plataforma de Comunicação Interna — Grupo Servsul', pageW / 2, y, { align: 'center' });
  y += 5;
  doc.text('Desenvolvido com React, TypeScript, Tailwind CSS e Lovable Cloud', pageW / 2, y, { align: 'center' });
  y += 5;
  doc.setTextColor(180, 180, 180);
  doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, pageW / 2, y, { align: 'center' });

  // =============================================
  // PAGE NUMBERS + DECORATIONS
  // =============================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageDecoration();
    // Header text
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text('ServChat — Documentação Técnica', margin, 10);
    doc.text('Grupo Servsul', pageW - margin, 10, { align: 'right' });
    // Page number
    doc.setFontSize(7.5);
    doc.setTextColor(...BLUE);
    doc.text(`${i} / ${totalPages}`, pageW / 2, pageH - 5, { align: 'center' });
  }
  // Cover page decoration
  doc.setPage(1);
  drawPageDecoration();

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
