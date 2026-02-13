import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Send, Users, User, Loader2, Shield, CheckCircle, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ActiveUser {
  id: string;
  user_id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string;
}

export function FeedbackEmailSection() {
  const { isAdmin, profile } = useAuth();
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingUser, setSendingUser] = useState<string | null>(null);
  const [sentUsers, setSentUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, name, display_name, avatar_url, email')
        .eq('is_active', true)
        .order('name');
      setUsers(data || []);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Shield className="mb-4 h-16 w-16 text-muted-foreground" />
        <h3 className="font-display text-xl font-semibold text-foreground">Acesso Restrito</h3>
        <p className="mt-2 text-muted-foreground">Apenas administradores podem acessar esta seção.</p>
      </div>
    );
  }

  const sendFeedback = async (targetUserId?: string) => {
    try {
      if (targetUserId) {
        setSendingUser(targetUserId);
      } else {
        setSendingAll(true);
      }

      const { data, error } = await supabase.functions.invoke('send-feedback-email', {
        body: {
          type: targetUserId ? 'individual' : 'all',
          targetUserId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (targetUserId) {
        setSentUsers(prev => new Set([...prev, targetUserId]));
        const parts = [];
        if (data.emailCount > 0) parts.push('e-mail');
        if (data.dmCount > 0) parts.push('mensagem no chat');
        if (data.pdfCount > 0) parts.push('PDF');
        toast.success(`Feedback enviado com sucesso (${parts.join(' + ')})!`);
      } else {
        setSentUsers(new Set(users.map(u => u.id)));
        toast.success(`Feedback enviado: ${data.emailCount} e-mail(s) + ${data.dmCount} chat(s) + ${data.pdfCount} PDF(s)!`);
      }

      if (data?.errors && data.errors.length > 0) {
        toast.warning(`${data.errors.length} erro(s) parcial(is). Verifique os logs.`);
      }
    } catch (error) {
      console.error('Error sending feedback:', error);
      toast.error(`Erro ao enviar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSendingUser(null);
      setSendingAll(false);
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Disparo de Feedback</h2>
          <p className="text-muted-foreground">Envio de e-mails e mensagens no chat com resumo mensal</p>
        </div>
      </div>

      {/* Auto info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Envio automático ativo</p>
              <p className="text-sm text-muted-foreground">
                O sistema envia automaticamente o feedback mensal todo dia 1º de cada mês. Cada usuário recebe um e-mail e uma mensagem direta do 🤖 ServChat Bot com o resumo e recomendações personalizadas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk send */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Envio em Massa — {currentMonth}
              </CardTitle>
              <CardDescription>{users.length} usuário(s) ativo(s)</CardDescription>
            </div>
            <Button onClick={() => sendFeedback()} disabled={sendingAll} className="gap-2">
              {sendingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sendingAll ? 'Enviando...' : 'Enviar para Todos'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Individual users */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Envio Individual
          </CardTitle>
          <CardDescription>Selecione um usuário para enviar o feedback individualmente</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-2">
                {users.map(user => {
                  const isSent = sentUsers.has(user.id);
                  const isSending = sendingUser === user.id;

                  return (
                    <div key={user.id} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || ''} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                          {getInitials(user.display_name || user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{user.display_name || user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      {isSent ? (
                        <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3" />
                          Enviado
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendFeedback(user.id)}
                          disabled={isSending}
                          className="gap-1"
                        >
                          {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          Enviar
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
