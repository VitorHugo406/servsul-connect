import { useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

interface SeasonalTheme {
  label: string;
  message: string;
  colors: string[];
  effect: 'confetti' | 'snow' | 'fireworks';
  emoji: string;
}

function getSeasonalTheme(): SeasonalTheme {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();

  // Christmas: Dec 20-30
  if (month === 11 && day >= 20 && day <= 30) {
    return {
      label: 'Feliz Natal!',
      message: 'Que o espírito natalino traga paz, amor e alegria para você e sua família!',
      colors: ['#c0392b', '#27ae60', '#f1c40f', '#ffffff'],
      effect: 'snow',
      emoji: '',
    };
  }

  // New Year: Dec 31 - Jan 10
  if ((month === 11 && day === 31) || (month === 0 && day <= 10)) {
    return {
      label: 'Feliz Ano Novo!',
      message: 'Que este novo ano seja repleto de realizações, saúde e muita prosperidade!',
      colors: ['#f1c40f', '#e67e22', '#ffffff', '#3498db'],
      effect: 'fireworks',
      emoji: '',
    };
  }

  // Monthly awareness themes
  const monthlyThemes: Record<number, SeasonalTheme> = {
    0: { // Janeiro Branco - Saúde Mental
      label: 'Janeiro Branco',
      message: 'Cuide da sua saúde mental! A mente precisa de atenção e carinho tanto quanto o corpo.',
      colors: ['#ecf0f1', '#bdc3c7', '#95a5a6', '#ffffff'],
      effect: 'confetti',
      emoji: '',
    },
    1: { // Fevereiro Roxo/Laranja
      label: 'Fevereiro Roxo & Laranja',
      message: 'Mês de conscientização sobre Alzheimer, Lúpus e Fibromialgia. Cuidar é um ato de amor!',
      colors: ['#8e44ad', '#e67e22', '#9b59b6', '#f39c12'],
      effect: 'confetti',
      emoji: '',
    },
    2: { // Março Lilás - Mulher
      label: 'Março Lilás',
      message: 'Mês da Mulher! Prevenção ao câncer de colo de útero. Cuide-se, você é importante!',
      colors: ['#8e44ad', '#9b59b6', '#d5a6e6', '#e8d5f5'],
      effect: 'confetti',
      emoji: '',
    },
    3: { // Abril Azul - Autismo
      label: 'Abril Azul',
      message: 'Conscientização sobre o Autismo. A inclusão começa com o respeito e a empatia!',
      colors: ['#2980b9', '#3498db', '#5dade2', '#85c1e9'],
      effect: 'confetti',
      emoji: '',
    },
    4: { // Maio Amarelo - Trânsito
      label: 'Maio Amarelo',
      message: 'Atenção pela vida! No trânsito, a responsabilidade é de todos. Dirija com prudência!',
      colors: ['#f1c40f', '#f39c12', '#e67e22', '#fdebd0'],
      effect: 'confetti',
      emoji: '',
    },
    5: { // Junho Vermelho - Doação de Sangue
      label: 'Junho Vermelho',
      message: 'Doe sangue, doe vida! Um gesto simples que pode salvar até 4 vidas.',
      colors: ['#e74c3c', '#c0392b', '#f1948a', '#fadbd8'],
      effect: 'confetti',
      emoji: '',
    },
    6: { // Julho Amarelo - Hepatites Virais
      label: 'Julho Amarelo',
      message: 'Prevenção contra Hepatites Virais. A informação é a melhor vacina!',
      colors: ['#f1c40f', '#f39c12', '#fad390', '#ffffff'],
      effect: 'confetti',
      emoji: '',
    },
    7: { // Agosto Dourado - Amamentação
      label: 'Agosto Dourado',
      message: 'Aleitamento materno: o alimento mais completo e natural para o bebê!',
      colors: ['#f39c12', '#e67e22', '#f1c40f', '#fdebd0'],
      effect: 'confetti',
      emoji: '',
    },
    8: { // Setembro Amarelo - Prevenção ao Suicídio
      label: 'Setembro Amarelo',
      message: 'A vida é a melhor escolha! Se precisar, peça ajuda. Ligue 188 - CVV. Você não está sozinho!',
      colors: ['#f1c40f', '#f39c12', '#fad390', '#ffffff'],
      effect: 'confetti',
      emoji: '',
    },
    9: { // Outubro Rosa - Câncer de Mama
      label: 'Outubro Rosa',
      message: 'A prevenção é o melhor caminho! Faça o autoexame e consulte seu médico regularmente.',
      colors: ['#e91e8c', '#ff69b4', '#ffb6c1', '#ffc0cb'],
      effect: 'confetti',
      emoji: '',
    },
    10: { // Novembro Azul - Câncer de Próstata
      label: 'Novembro Azul',
      message: 'Homem que se cuida vive mais! A prevenção e o diagnóstico precoce salvam vidas.',
      colors: ['#2980b9', '#3498db', '#1a5276', '#d6eaf8'],
      effect: 'confetti',
      emoji: '',
    },
    11: { // Dezembro Vermelho - AIDS
      label: 'Dezembro Vermelho',
      message: 'Prevenção ao HIV/AIDS. Informação, prevenção e respeito. Juntos somos mais fortes!',
      colors: ['#e74c3c', '#c0392b', '#f1948a', '#ffffff'],
      effect: 'confetti',
      emoji: '',
    },
  };

  return monthlyThemes[month];
}

function fireSnowEffect() {
  const duration = 4000;
  const end = Date.now() + duration;

  const snowInterval = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(snowInterval);
      return;
    }
    confetti({
      particleCount: 3,
      startVelocity: 0,
      gravity: 0.5,
      spread: 360,
      ticks: 200,
      origin: { x: Math.random(), y: -0.1 },
      colors: ['#ffffff', '#dfe6e9', '#b2bec3'],
      shapes: ['circle'],
      scalar: 1.2,
      drift: Math.random() * 2 - 1,
    });
  }, 50);
}

function fireFireworksEffect() {
  const duration = 3000;
  const end = Date.now() + duration;

  const fireworkInterval = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(fireworkInterval);
      return;
    }
    confetti({
      particleCount: 80,
      startVelocity: 30,
      spread: 360,
      origin: { x: Math.random(), y: Math.random() * 0.4 },
      colors: ['#f1c40f', '#e67e22', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'],
      ticks: 100,
    });
  }, 400);
}

function fireConfettiEffect(colors: string[]) {
  confetti({
    particleCount: 120,
    spread: 100,
    origin: { y: 0.6 },
    colors,
    ticks: 150,
  });
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 80,
      origin: { x: 0, y: 0.6 },
      colors,
    });
  }, 300);
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 80,
      origin: { x: 1, y: 0.6 },
      colors,
    });
  }, 500);
}

export function SeasonalEffectsButton({ collapsed }: { collapsed?: boolean }) {
  const [showMessage, setShowMessage] = useState(false);
  const theme = getSeasonalTheme();

  const handleClick = useCallback(() => {
    setShowMessage(true);
    setTimeout(() => setShowMessage(false), 5000);

    switch (theme.effect) {
      case 'snow':
        fireSnowEffect();
        break;
      case 'fireworks':
        fireFireworksEffect();
        break;
      case 'confetti':
        fireConfettiEffect(theme.colors);
        break;
    }
  }, [theme]);

  if (!theme) return null;

  return (
    <>
      <Button
        variant="ghost"
        onClick={handleClick}
        className={`w-full gap-2 justify-start rounded-xl px-4 py-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all ${collapsed ? 'justify-center px-0' : ''}`}
        title={theme.label}
      >
        <Sparkles className="h-5 w-5 flex-shrink-0 text-amber-400" />
        {!collapsed && (
          <span className="overflow-hidden whitespace-nowrap font-medium text-sm">
            Evento Mensal
          </span>
        )}
      </Button>

      <AnimatePresence>
        {showMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] max-w-sm w-[90vw]"
          >
            <div className="rounded-2xl bg-card border border-border shadow-2xl p-5 text-center">
              <h3 className="text-lg font-bold text-foreground mb-1">{theme.label}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{theme.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
