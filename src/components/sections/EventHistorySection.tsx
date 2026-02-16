import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Sparkles } from 'lucide-react';

interface EventInfo {
  month: string;
  label: string;
  period: string;
  message: string;
  colors: string[];
  effect: string;
}

const SEASONAL_EVENTS: EventInfo[] = [
  {
    month: 'Janeiro',
    label: 'Janeiro Branco',
    period: '1 a 31 de Janeiro',
    message: 'Cuide da sua saude mental! A mente precisa de atencao e carinho tanto quanto o corpo.',
    colors: ['#ecf0f1', '#bdc3c7', '#95a5a6', '#ffffff'],
    effect: 'confetti',
  },
  {
    month: 'Fevereiro',
    label: 'Fevereiro Roxo & Laranja',
    period: '1 a 28/29 de Fevereiro',
    message: 'Mes de conscientizacao sobre Alzheimer, Lupus e Fibromialgia. Cuidar e um ato de amor!',
    colors: ['#8e44ad', '#e67e22', '#9b59b6', '#f39c12'],
    effect: 'confetti',
  },
  {
    month: 'Marco',
    label: 'Marco Lilas',
    period: '1 a 31 de Marco',
    message: 'Mes da Mulher! Prevencao ao cancer de colo de utero. Cuide-se, voce e importante!',
    colors: ['#8e44ad', '#9b59b6', '#d5a6e6', '#e8d5f5'],
    effect: 'confetti',
  },
  {
    month: 'Abril',
    label: 'Abril Azul',
    period: '1 a 30 de Abril',
    message: 'Conscientizacao sobre o Autismo. A inclusao comeca com o respeito e a empatia!',
    colors: ['#2980b9', '#3498db', '#5dade2', '#85c1e9'],
    effect: 'confetti',
  },
  {
    month: 'Maio',
    label: 'Maio Amarelo',
    period: '1 a 31 de Maio',
    message: 'Atencao pela vida! No transito, a responsabilidade e de todos. Dirija com prudencia!',
    colors: ['#f1c40f', '#f39c12', '#e67e22', '#fdebd0'],
    effect: 'confetti',
  },
  {
    month: 'Junho',
    label: 'Junho Vermelho',
    period: '1 a 30 de Junho',
    message: 'Doe sangue, doe vida! Um gesto simples que pode salvar ate 4 vidas.',
    colors: ['#e74c3c', '#c0392b', '#f1948a', '#fadbd8'],
    effect: 'confetti',
  },
  {
    month: 'Julho',
    label: 'Julho Amarelo',
    period: '1 a 31 de Julho',
    message: 'Prevencao contra Hepatites Virais. A informacao e a melhor vacina!',
    colors: ['#f1c40f', '#f39c12', '#fad390', '#ffffff'],
    effect: 'confetti',
  },
  {
    month: 'Agosto',
    label: 'Agosto Dourado',
    period: '1 a 31 de Agosto',
    message: 'Aleitamento materno: o alimento mais completo e natural para o bebe!',
    colors: ['#f39c12', '#e67e22', '#f1c40f', '#fdebd0'],
    effect: 'confetti',
  },
  {
    month: 'Setembro',
    label: 'Setembro Amarelo',
    period: '1 a 30 de Setembro',
    message: 'A vida e a melhor escolha! Se precisar, peca ajuda. Ligue 188 - CVV.',
    colors: ['#f1c40f', '#f39c12', '#fad390', '#ffffff'],
    effect: 'confetti',
  },
  {
    month: 'Outubro',
    label: 'Outubro Rosa',
    period: '1 a 31 de Outubro',
    message: 'A prevencao e o melhor caminho! Faca o autoexame e consulte seu medico regularmente.',
    colors: ['#e91e8c', '#ff69b4', '#ffb6c1', '#ffc0cb'],
    effect: 'confetti',
  },
  {
    month: 'Novembro',
    label: 'Novembro Azul',
    period: '1 a 30 de Novembro',
    message: 'Homem que se cuida vive mais! A prevencao e o diagnostico precoce salvam vidas.',
    colors: ['#2980b9', '#3498db', '#1a5276', '#d6eaf8'],
    effect: 'confetti',
  },
  {
    month: 'Dezembro',
    label: 'Dezembro Vermelho + Natal + Ano Novo',
    period: '1-19 Dez: Conscientizacao HIV | 20-30 Dez: Natal | 31 Dez - 10 Jan: Ano Novo',
    message: 'Prevencao ao HIV/AIDS + Feliz Natal + Feliz Ano Novo!',
    colors: ['#e74c3c', '#c0392b', '#27ae60', '#f1c40f'],
    effect: 'confetti / neve / fogos',
  },
];

export function EventHistorySection() {
  const currentMonth = new Date().getMonth();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-amber-400" />
          Eventos Mensais
        </h3>
        <p className="text-muted-foreground">Historico de campanhas de conscientizacao e datas comemorativas</p>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SEASONAL_EVENTS.map((event, index) => {
            const isCurrentMonth = index === currentMonth;
            return (
              <motion.div
                key={event.month}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`hover:shadow-md transition-shadow ${isCurrentMonth ? 'ring-2 ring-primary' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{event.label}</CardTitle>
                      {isCurrentMonth && (
                        <Badge variant="default" className="text-xs">Atual</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{event.period}</span>
                    </div>

                    <p className="text-sm text-foreground leading-relaxed">{event.message}</p>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Cores do confete:</p>
                      <div className="flex gap-1.5">
                        {event.colors.map((color, i) => (
                          <div
                            key={i}
                            className="h-5 w-5 rounded-full border border-border"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Efeito: <span className="font-medium text-foreground">{event.effect}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>
    </motion.div>
  );
}
