import { motion } from 'framer-motion';
import { Cake, Gift, PartyPopper, Calendar, CheckCircle2 } from 'lucide-react';
import { useBirthdays } from '@/hooks/useData';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export function BirthdaysSection() {
  const { birthdayPeople, loading, currentDay } = useBirthdays();

  // Split birthdays: today, upcoming (not yet happened), and past (already happened this month)
  const todayBirthdays = birthdayPeople.filter((p) => p.isToday);
  
  const upcomingBirthdays = birthdayPeople.filter((p) => {
    if (p.isToday) return false;
    return p.birthDay > currentDay;
  });

  const pastBirthdays = birthdayPeople.filter((p) => {
    if (p.isToday) return false;
    return p.birthDay < currentDay;
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const formatBirthday = (dateStr: string) => {
    // Parse date string in YYYY-MM-DD format correctly
    const [year, month, day] = dateStr.split('-').map(Number);
    // Create date using UTC to avoid timezone issues
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6"
    >
      {/* Today's Birthdays */}
      {todayBirthdays.length > 0 && (
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-secondary shadow-glow">
              <PartyPopper className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-bold text-foreground">
                Aniversariantes de Hoje! 🎉
              </h3>
              <p className="text-muted-foreground">Não esqueça de parabenizar!</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {todayBirthdays.map((person, index) => (
              <motion.div
                key={person.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="overflow-hidden border-2 border-secondary/30 bg-gradient-to-br from-secondary/5 to-secondary/10">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-20 w-20 ring-4 ring-secondary/30">
                          <AvatarImage src={person.avatar} />
                          <AvatarFallback className="bg-secondary text-secondary-foreground text-xl font-bold">
                            {getInitials(person.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-lg">
                          <span className="text-2xl">🎂</span>
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="font-display text-xl font-bold text-foreground">
                          {person.name}
                        </h4>
                        <p className="mb-2 text-sm text-muted-foreground">{person.sector}</p>
                        <Badge className="bg-secondary text-secondary-foreground">
                          <Cake className="mr-1 h-3 w-3" />
                          Hoje!
                        </Badge>
                      </div>
                      
                      <motion.div
                        animate={{ rotate: [0, -10, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 2, repeatDelay: 1 }}
                      >
                        <Gift className="h-8 w-8 text-secondary" />
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Birthdays */}
      {upcomingBirthdays.length > 0 && (
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-foreground">
                Próximos Aniversariantes
              </h3>
              <p className="text-sm text-muted-foreground">Este mês</p>
            </div>
          </div>

          <div className="space-y-3">
            {upcomingBirthdays.map((person, index) => (
              <motion.div
                key={person.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="transition-all hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={person.avatar} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(person.name)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">{person.name}</h4>
                      <p className="text-sm text-muted-foreground">{person.sector}</p>
                    </div>
                    
                    <Badge variant="outline" className="text-muted-foreground">
                      <Cake className="mr-1 h-3 w-3" />
                      {formatBirthday(person.birthDate)}
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Past Birthdays this month */}
      {pastBirthdays.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-foreground">
                Aniversários já realizados neste mês
              </h3>
              <p className="text-sm text-muted-foreground">Já celebramos!</p>
            </div>
          </div>

          <div className="space-y-2">
            {pastBirthdays.map((person, index) => (
              <motion.div
                key={person.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="transition-all opacity-70 hover:opacity-100">
                  <CardContent className="flex items-center gap-4 p-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={person.avatar} />
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        {getInitials(person.name)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">{person.name}</h4>
                      <p className="text-sm text-muted-foreground">{person.sector}</p>
                    </div>
                    
                    <Badge variant="secondary" className="text-muted-foreground">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      {formatBirthday(person.birthDate)}
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* No birthdays at all */}
      {birthdayPeople.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <span className="text-4xl">🎂</span>
          </div>
          <h4 className="font-display text-lg font-semibold text-foreground">
            Nenhum aniversariante
          </h4>
          <p className="text-sm text-muted-foreground">
            Não há aniversariantes neste mês com data de nascimento cadastrada
          </p>
        </div>
      )}
    </motion.div>
  );
}
