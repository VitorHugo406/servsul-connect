import { useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Robot3D } from './Robot3D';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const steps = [
  {
    title: 'BEM-VINDO AO SERVCHAT',
    content: 'Este é o ServChat, um sistema completo para atendimento, organização de equipes e comunicação com clientes.',
    mascotAction: 'wave', // acenando
  },
  {
    title: 'COMO FUNCIONA O CHAT',
    content: '',
    details: [
      '💬 Conversas em tempo real',
      '📜 Histórico de mensagens',
      '📎 Envio de arquivos',
      '📋 Organização de atendimentos',
    ],
    mascotAction: 'point',
  },
  {
    title: 'TIPOS DE USUÁRIOS',
    content: '',
    details: [
      '🔑 ADMINISTRADOR — Acesso total ao sistema, gerencia usuários e configurações.',
      '👁️ SUPERVISOR — Monitora equipes e atendimentos do setor.',
      '🏢 DIRETORIA — Visão gerencial com acesso a relatórios.',
      '👤 COLABORADOR — Realiza atendimentos e interage nos chats.',
    ],
    mascotAction: 'point',
  },
  {
    title: 'ORGANIZAÇÃO POR SETORES',
    content: 'Os atendimentos podem ser separados por setores como:',
    details: [
      '🛠️ SUPORTE',
      '💰 FINANCEIRO',
      '🛒 VENDAS',
      '📞 ATENDIMENTO GERAL',
    ],
    mascotAction: 'point',
  },
  {
    title: 'DISTRIBUIÇÃO INTELIGENTE',
    content: '',
    details: [
      '🔄 Encaminhamento automático de tarefas',
      '📊 Fila de atendimento organizada',
      '↔️ Transferência entre atendentes',
    ],
    mascotAction: 'point',
  },
  {
    title: 'EVENTO MENSAL',
    content: 'A área de eventos mostra:',
    details: [
      '📢 Comunicados importantes',
      '🆕 Novidades do sistema',
      '👥 Atualizações da equipe',
    ],
    mascotAction: 'point',
  },
  {
    title: 'NOTIFICAÇÕES',
    content: 'O sistema envia notificações para:',
    details: [
      '✉️ Novas mensagens',
      '🎫 Novos atendimentos',
      '🔔 Atualizações do sistema',
    ],
    mascotAction: 'point',
  },
  {
    title: 'TUTORIAL CONCLUÍDO',
    content: 'Agora você já conhece as principais funcionalidades do ServChat. Explore o sistema e comece seus atendimentos!',
    mascotAction: 'thumbsup',
  },
];

// Removed 2D mascot variants - using 3D robot now

export function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const next = () => {
    if (isLast) {
      handleClose();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const prev = () => {
    if (!isFirst) setCurrentStep((s) => s - 1);
  };

  const handleClose = () => {
    setCurrentStep(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-background border border-border shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold text-muted-foreground">
                  Tutorial ServChat
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground">
                  {currentStep + 1}/{steps.length}
                </span>
                <button
                  onClick={handleClose}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Progress */}
            <div className="px-6 pt-3">
              <Progress value={progress} className="h-1.5" />
            </div>

            {/* Content area */}
            <div className="flex flex-col md:flex-row gap-6 p-6 min-h-[340px]">
              {/* 3D Robot Mascot */}
              <div className="flex flex-col items-center justify-center md:w-1/3 shrink-0 h-[200px] md:h-auto">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                }>
                  <Robot3D action={step.mascotAction as 'wave' | 'point' | 'thumbsup'} />
                </Suspense>
              </div>

              {/* Whiteboard / Lousa */}
              <div className="flex-1 flex flex-col">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.3 }}
                    className="flex-1 rounded-xl bg-card border-2 border-border p-5 md:p-6 shadow-inner relative overflow-hidden"
                  >
                    {/* Chalk-like top decoration */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40 rounded-t-xl" />

                    <h2 className="text-lg md:text-xl font-bold text-foreground tracking-wide mb-3">
                      {step.title}
                    </h2>

                    {step.content && (
                      <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-3">
                        {step.content}
                      </p>
                    )}

                    {step.details && (
                      <ul className="space-y-2.5">
                        {step.details.map((detail, i) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 + i * 0.1 }}
                            className="text-sm md:text-base text-foreground/90 leading-relaxed"
                          >
                            {detail}
                          </motion.li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
              <div className="flex items-center gap-2">
                {!isFirst && (
                  <Button variant="ghost" size="sm" onClick={prev} className="gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                )}
                {!isLast && (
                  <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground text-xs">
                    PULAR TUTORIAL
                  </Button>
                )}
              </div>

              <Button onClick={next} size="sm" className="gap-1">
                {isLast ? (
                  <>
                    <Rocket className="h-4 w-4" />
                    COMEÇAR A USAR O SERVCHAT
                  </>
                ) : (
                  <>
                    {isFirst ? 'PROSSEGUIR' : 'Avançar'}
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
