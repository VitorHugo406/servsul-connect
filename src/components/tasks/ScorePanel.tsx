import { motion } from 'framer-motion';
import { Trophy, Medal, TrendingUp, TrendingDown, Minus, Crown, Award, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MemberScore, MonthlyScoreEntry } from '@/hooks/useBoardScores';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

const LINE_COLORS = [
  'hsl(var(--primary))',
  'hsl(38, 92%, 50%)',
  'hsl(142, 76%, 36%)',
  'hsl(270, 76%, 55%)',
  'hsl(0, 72%, 51%)',
  'hsl(200, 80%, 50%)',
];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function getScoreColor(score: number): string {
  if (score >= 800) return 'text-green-500';
  if (score >= 600) return 'text-yellow-500';
  if (score >= 400) return 'text-orange-500';
  return 'text-destructive';
}

function getScoreLabel(score: number): string {
  if (score >= 900) return 'Excelente';
  if (score >= 700) return 'Bom';
  if (score >= 500) return 'Regular';
  if (score >= 300) return 'Baixo';
  return 'Crítico';
}

const podiumIcons = [
  <Crown className="h-6 w-6 text-yellow-500" />,
  <Medal className="h-5 w-5 text-gray-400" />,
  <Medal className="h-5 w-5 text-amber-700" />,
];

interface ScorePanelProps {
  open: boolean;
  onClose: () => void;
  scores: MemberScore[];
  monthlyHistory: MonthlyScoreEntry[];
  loading: boolean;
  title?: string;
}

export function ScorePanel({ open, onClose, scores, monthlyHistory, loading, title = 'Score do Quadro' }: ScorePanelProps) {
  // Build chart data
  const uniqueMonths = [...new Set(monthlyHistory.map(h => h.yearMonth))].sort();
  const uniqueProfiles = [...new Set(monthlyHistory.map(h => h.profileId))];
  const profileNames: Record<string, string> = {};
  monthlyHistory.forEach(h => { profileNames[h.profileId] = h.name; });

  const chartData = uniqueMonths.map(ym => {
    const [year, month] = ym.split('-');
    const entry: any = { month: `${MONTH_LABELS[month]}/${year.slice(2)}` };
    uniqueProfiles.forEach(pid => {
      const record = monthlyHistory.find(h => h.yearMonth === ym && h.profileId === pid);
      entry[pid] = record?.score || 0;
    });
    return entry;
  });

  const top3 = scores.slice(0, 3);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col p-4 sm:p-6">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            {title}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : scores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="font-medium text-foreground">Sem dados de score</p>
              <p className="text-sm text-muted-foreground">Nenhum membro com tarefas ainda.</p>
            </div>
          ) : (
            <div className="space-y-6 pb-6">
              {/* Podium */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-500" />
                    Pódio
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex items-end justify-center gap-3 pt-4">
                    {/* 2nd place */}
                    {top3.length >= 2 && (
                      <PodiumPlace member={top3[1]} place={2} height="h-20" />
                    )}
                    {/* 1st place */}
                    {top3.length >= 1 && (
                      <PodiumPlace member={top3[0]} place={1} height="h-28" />
                    )}
                    {/* 3rd place */}
                    {top3.length >= 3 && (
                      <PodiumPlace member={top3[2]} place={3} height="h-14" />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* All members scores */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary" />
                    Ranking Completo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {scores.map((member, i) => (
                    <motion.div
                      key={member.profileId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <span className="font-bold text-lg text-muted-foreground w-6 text-center">
                        {i + 1}
                      </span>
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.avatarUrl || ''} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {getInitials(member.displayName || member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{member.displayName || member.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={member.score / 10} className="h-1.5 flex-1" />
                          <span className={cn('text-xs font-bold', getScoreColor(member.score))}>
                            {member.score}/1000
                          </span>
                        </div>
                        <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>{member.totalTasks} tarefas</span>
                          <span>•</span>
                          <span>{member.completedTasks} concluídas</span>
                          <span>•</span>
                          <span>{member.lateTasks} atrasadas</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn('text-xs', getScoreColor(member.score))}>
                        {getScoreLabel(member.score)}
                      </Badge>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>

              {/* Monthly chart */}
              {chartData.length > 0 && uniqueProfiles.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      Evolução Mensal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                          <YAxis domain={[0, 1000]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                          />
                          <Legend />
                          {uniqueProfiles.slice(0, 6).map((pid, i) => (
                            <Line
                              key={pid}
                              type="monotone"
                              dataKey={pid}
                              name={profileNames[pid] || 'Usuário'}
                              stroke={LINE_COLORS[i % LINE_COLORS.length]}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function PodiumPlace({ member, place, height }: { member: MemberScore; place: number; height: string }) {
  const bgColors = ['bg-yellow-500/10', 'bg-gray-400/10', 'bg-amber-700/10'];
  const borderColors = ['border-yellow-500', 'border-gray-400', 'border-amber-700'];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: place === 1 ? 0.1 : place === 2 ? 0.2 : 0.3 }}
      className="flex flex-col items-center gap-2 w-24"
    >
      <div className="relative">
        <Avatar className={cn('h-12 w-12 border-2', borderColors[place - 1])}>
          <AvatarImage src={member.avatarUrl || ''} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
            {getInitials(member.displayName || member.name)}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -top-2 -right-2">
          {podiumIcons[place - 1]}
        </div>
      </div>
      <p className="text-xs font-medium text-center truncate w-full">{(member.displayName || member.name).split(' ')[0]}</p>
      <div className={cn('w-full rounded-t-lg flex items-end justify-center pb-2', bgColors[place - 1], height)}>
        <span className={cn('text-sm font-bold', getScoreColor(member.score))}>
          {member.score}
        </span>
      </div>
    </motion.div>
  );
}
