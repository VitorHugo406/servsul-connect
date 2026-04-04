import { useState, useMemo, useEffect } from 'react';
import { Search, Bell, User, Moon, Sun, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useNotifications } from '@/hooks/useNotifications';
import { UserProfileDialog } from '@/components/user/UserProfileDialog';
import { TeamHeaderButton } from '@/components/teams/TeamHeaderButton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  subtitle?: string;
  hideNotifications?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onNavigateToSection?: (section: string) => void;
}

const ALL_SECTIONS = [
  { id: 'home', label: 'Inicio', description: 'Visao geral do ServChat' },
  { id: 'chat', label: 'Chat por Setores', description: 'Comunicacao entre equipes' },
  { id: 'announcements', label: 'Avisos Gerais', description: 'Comunicados oficiais' },
  { id: 'birthdays', label: 'Aniversariantes', description: 'Mural de celebracoes' },
  { id: 'tasks', label: 'Gestao de Tarefas', description: 'Quadro de atividades' },
  { id: 'people-management', label: 'Gestao de Pessoas', description: 'Equipe e relatorios' },
  { id: 'management', label: 'Gerenciamento', description: 'Administracao do sistema' },
  { id: 'sectors', label: 'Gestao de Setores', description: 'Departamentos da empresa' },
  { id: 'important-announcements', label: 'Comunicados Importantes', description: 'Avisos em destaque' },
  { id: 'data-management', label: 'Exclusao de Dados', description: 'Gerenciamento de dados' },
  { id: 'feedback-email', label: 'Disparo de Feedback', description: 'E-mails de feedback mensal' },
  { id: 'facial', label: 'Cadastro Facial', description: 'Reconhecimento biometrico' },
  { id: 'system-logs', label: 'Logs do Sistema', description: 'Auditoria e relatorios' },
  { id: 'event-history', label: 'Eventos Mensais', description: 'Historico de campanhas' },
  { id: 'storage', label: 'Armazenamento', description: 'Monitoramento do banco de dados' },
];

export function Header({ title, subtitle, hideNotifications = false, searchQuery = '', onSearchChange, onNavigateToSection }: HeaderProps) {
  const { counts } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSectionSearch, setShowSectionSearch] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return ALL_SECTIONS.filter(s =>
      s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleSelectSection = (sectionId: string) => {
    onNavigateToSection?.(sectionId);
    onSearchChange?.('');
    setShowSectionSearch(false);
  };

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-16 items-center justify-between border-b border-border bg-card px-6"
      >
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        
        <div className="flex items-center gap-4">
          {/* Section Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Busca de Abas..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange?.(e.target.value);
                setShowSectionSearch(true);
              }}
              onFocus={() => { if (searchQuery) setShowSectionSearch(true); }}
              onBlur={() => setTimeout(() => setShowSectionSearch(false), 200)}
              className="w-64 bg-muted/50 pl-10 focus-visible:ring-primary"
            />
            {/* Dropdown results */}
            {showSectionSearch && filteredSections.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                {filteredSections.map(section => (
                  <button
                    key={section.id}
                    onMouseDown={(e) => { e.preventDefault(); handleSelectSection(section.id); }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{section.label}</p>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showSectionSearch && searchQuery && filteredSections.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-border bg-card shadow-lg p-4 text-center text-sm text-muted-foreground">
                Nenhuma aba encontrada
              </div>
            )}
          </div>

          {/* Orbs External Link */}
          <Button variant="outline" size="sm" className="gap-1.5 hidden md:flex" asChild>
            <a href="https://sync-synergy-flow.vercel.app/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Orbs
            </a>
          </Button>

          {/* Team Header Button */}
          <TeamHeaderButton />
          
          {/* Notifications - hidden on home page */}
          {!hideNotifications && (
            <Popover open={showNotifications} onOpenChange={setShowNotifications}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {counts.total > 0 && (
                    <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center bg-secondary p-0 text-xs">
                      {counts.total > 99 ? '99+' : counts.total}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="border-b border-border p-4">
                  <h3 className="font-semibold">Notificacoes</h3>
                </div>
                <ScrollArea className="h-64">
                  <div className="p-4 space-y-3">
                    {counts.unreadMessages > 0 && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Mensagens nao lidas</p>
                          <p className="text-xs text-muted-foreground">
                            {counts.unreadMessages} {counts.unreadMessages === 1 ? 'mensagem' : 'mensagens'}
                          </p>
                        </div>
                      </div>
                    )}
                    {counts.unreadAnnouncements > 0 && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="h-2 w-2 rounded-full bg-secondary" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Avisos nao lidos</p>
                          <p className="text-xs text-muted-foreground">
                            {counts.unreadAnnouncements} {counts.unreadAnnouncements === 1 ? 'aviso' : 'avisos'}
                          </p>
                        </div>
                      </div>
                    )}
                    {counts.total === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhuma notificacao</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}

          {/* Dark Mode Toggle */}
          <Button variant="ghost" size="icon" onClick={toggleDarkMode} title={isDark ? 'Modo Claro' : 'Modo Noturno'}>
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* Profile button */}
          <Button variant="ghost" size="icon" onClick={() => setShowProfile(true)}>
            <User className="h-5 w-5" />
          </Button>
          
          {/* Date */}
          <div className="hidden text-right lg:block">
            <p className="text-sm font-medium text-foreground">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </motion.header>

      <UserProfileDialog open={showProfile} onOpenChange={setShowProfile} />
    </>
  );
}
