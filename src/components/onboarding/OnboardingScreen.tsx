import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Users,
  Bell,
  Calendar,
  BarChart3,
  Shield,
  Camera,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface OnboardingScreenProps {
  userName: string;
  onComplete: () => void;
  onRegisterFacial?: () => void;
}

const features = [
  {
    icon: MessageSquare,
    title: 'Chat por Setores',
    description: 'Converse com sua equipe em tempo real. Mensagens com status de envio (✓) e confirmação (✓✓).',
    color: 'bg-primary/10 text-primary',
  },
  {
    icon: Users,
    title: 'Mensagens Diretas',
    description: 'Envie mensagens privadas para qualquer colaborador da empresa com total privacidade.',
    color: 'bg-secondary/10 text-secondary',
  },
  {
    icon: Bell,
    title: 'Avisos Gerais',
    description: 'Fique por dentro de todos os comunicados oficiais da empresa em um só lugar.',
    color: 'bg-warning/10 text-warning',
  },
  {
    icon: Calendar,
    title: 'Aniversariantes',
    description: 'Celebre com seus colegas! Veja quem faz aniversário no mês e não esqueça de parabenizar.',
    color: 'bg-accent/10 text-accent-foreground',
  },
  {
    icon: BarChart3,
    title: 'Formatação de Texto',
    description: 'Use *texto* para negrito, _texto_ para itálico, ~texto~ para riscado e [texto](url) para links nas mensagens.',
    color: 'bg-primary/10 text-primary',
  },
  {
    icon: Shield,
    title: 'Feedback Mensal com PDF',
    description: 'Receba relatórios mensais com resumo de atividades, gráficos e recomendações em PDF para download.',
    color: 'bg-destructive/10 text-destructive',
  },
];

export function OnboardingScreen({ userName, onComplete, onRegisterFacial }: OnboardingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const isMobile = useIsMobile();
  const totalSteps = 3; // Welcome, Features, Finish

  const firstName = userName.split(' ')[0];

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="absolute inset-0 gradient-hero opacity-90" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/5"
            style={{
              width: Math.random() * 300 + 100,
              height: Math.random() * 300 + 100,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              x: [0, Math.random() * 100 - 50],
              y: [0, Math.random() * 100 - 50],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-2xl px-4">
        <AnimatePresence mode="wait">
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center text-white"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl gradient-secondary shadow-glow"
              >
                <MessageSquare className="h-12 w-12" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">
                  Bem-vindo ao ServChat!
                </h1>
                <p className="text-xl md:text-2xl text-white/80 mb-2">
                  Olá, <span className="font-semibold text-secondary">{firstName}</span>! 👋
                </p>
                <p className="text-white/70 max-w-md mx-auto leading-relaxed">
                  Estamos muito felizes em ter você aqui. Vamos fazer um tour rápido
                  para você conhecer todas as funcionalidades disponíveis.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-12"
              >
                <Button
                  size="lg"
                  onClick={nextStep}
                  className="gap-2 bg-white text-primary hover:bg-white/90 px-8 py-6 text-lg rounded-xl shadow-lg"
                >
                  Começar Tour
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* Step 1: Features */}
          {currentStep === 1 && (
            <motion.div
              key="features"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center text-white mb-8">
                <h2 className="font-display text-2xl md:text-3xl font-bold mb-2">
                  O que você pode fazer
                </h2>
                <p className="text-white/70">
                  Conheça as principais funcionalidades do ServChat
                </p>
              </div>

              <div className={cn(
                "grid gap-3",
                isMobile ? "grid-cols-1" : "grid-cols-2"
              )}>
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/15 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0",
                          feature.color
                        )}>
                          <feature.icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-white text-sm">
                            {feature.title}
                          </h3>
                          <p className="text-xs text-white/70 mt-0.5 leading-relaxed">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>

              <div className="flex justify-between mt-8">
                <Button
                  variant="ghost"
                  onClick={prevStep}
                  className="text-white hover:bg-white/10 gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <Button
                  onClick={nextStep}
                  className="gap-2 bg-white text-primary hover:bg-white/90"
                >
                  Continuar
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Finish */}
          {currentStep === 2 && (
            <motion.div
              key="finish"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center text-white"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-secondary/20"
              >
                <Sparkles className="h-10 w-10 text-secondary" />
              </motion.div>

              <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">
                Você está pronto!
              </h2>
              <p className="text-white/70 max-w-md mx-auto leading-relaxed mb-8">
                Agora você conhece as principais funcionalidades do ServChat.
                Antes de começar, que tal cadastrar seu reconhecimento facial
                para um acesso mais rápido?
              </p>

              <div className="space-y-4">
                {onRegisterFacial && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Card 
                      className="p-4 bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/15 transition-colors cursor-pointer mx-auto max-w-sm"
                      onClick={onRegisterFacial}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/20 flex-shrink-0">
                          <Camera className="h-6 w-6 text-secondary" />
                        </div>
                        <div className="flex-1 text-left">
                          <h3 className="font-semibold text-white">
                            Cadastrar Reconhecimento Facial
                          </h3>
                          <p className="text-xs text-white/70">
                            Login rápido e seguro com seu rosto
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-white/50" />
                      </div>
                    </Card>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-col items-center gap-4 pt-4"
                >
                  <Button
                    size="lg"
                    onClick={onComplete}
                    className="gap-2 bg-white text-primary hover:bg-white/90 px-8 py-6 text-lg rounded-xl shadow-lg"
                  >
                    Entrar no ServChat
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                  
                  <button
                    onClick={prevStep}
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Voltar ao tour
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mt-8">
          {[...Array(totalSteps)].map((_, i) => (
            <motion.div
              key={i}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === currentStep ? "w-8 bg-white" : "w-2 bg-white/30"
              )}
              animate={{
                scale: i === currentStep ? 1 : 0.8,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
