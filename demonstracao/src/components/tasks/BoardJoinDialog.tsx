import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ListTodo, UserPlus, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface BoardJoinDialogProps {
  token: string | null;
  onClose: () => void;
  onNavigateToTasks: () => void;
}

export function BoardJoinDialog({ token, onClose, onNavigateToTasks }: BoardJoinDialogProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [boardInfo, setBoardInfo] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const [status, setStatus] = useState<'idle' | 'already_member' | 'pending' | 'sent' | 'error'>('idle');
  const normalizedToken = useMemo(() => {
    if (!token) return null;
    const sanitized = token.trim().split(/[?#&]/)[0];
    return sanitized || null;
  }, [token]);

  useEffect(() => {
    if (!normalizedToken || !user) return;

    const lookupBoard = async () => {
      setLoading(true);
      try {
        const { data: linkRows, error: linkErr } = await (supabase as any)
          .rpc('resolve_board_share_link', { _token: normalizedToken });

        const link = Array.isArray(linkRows) ? linkRows[0] : linkRows;

        if (linkErr || !link) {
          setStatus('error');
          setLoading(false);
          return;
        }

        const boardId = link.board_id;

        setBoardInfo({
          id: boardId,
          name: link.board_name || 'Quadro compartilhado',
          description: link.board_description ?? null,
        });



        const { data: membership } = await (supabase as any)
          .from('task_board_members')
          .select('id')
          .eq('board_id', boardId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (membership) {
          setStatus('already_member');
          setLoading(false);
          return;
        }

        const { data: ownerBoard } = await (supabase as any)
          .from('task_boards')
          .select('id')
          .eq('id', boardId)
          .eq('owner_id', user.id)
          .maybeSingle();

        if (ownerBoard) {
          setStatus('already_member');
          setLoading(false);
          return;
        }

        const { data: existingReq } = await (supabase as any)
          .from('board_join_requests')
          .select('id, status')
          .eq('board_id', boardId)
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .maybeSingle();

        if (existingReq) {
          setStatus('pending');
          setLoading(false);
          return;
        }

        setStatus('idle');
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
      setLoading(false);
    };

    lookupBoard();
  }, [normalizedToken, user]);

  const handleSendRequest = async () => {
    if (!boardInfo || !user || !profile) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('board_join_requests')
        .insert({
          board_id: boardInfo.id,
          user_id: user.id,
          profile_id: profile.id,
          status: 'pending',
        });

      if (error) {
        console.error(error);
        toast.error('Erro ao enviar solicitação');
      } else {
        setStatus('sent');
        toast.success('Solicitação enviada com sucesso!');
      }
    } catch (err) {
      toast.error('Erro ao enviar solicitação');
    }
    setSubmitting(false);
  };

  const handleGoToBoard = () => {
    onClose();
    onNavigateToTasks();
  };

  if (!normalizedToken) return null;

  return (
    <Dialog open={!!normalizedToken} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            Convite para Quadro
          </DialogTitle>
          <DialogDescription>
            Você recebeu um link de compartilhamento de quadro
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verificando convite...</p>
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <XCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm font-medium">Link inválido ou expirado</p>
            <p className="text-xs text-muted-foreground text-center">
              O link de compartilhamento não é mais válido. Peça um novo link ao administrador do quadro.
            </p>
          </div>
        ) : status === 'already_member' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium">Você já é membro deste quadro!</p>
            {boardInfo && (
              <p className="text-xs text-muted-foreground">Quadro: <strong>{boardInfo.name}</strong></p>
            )}
          </div>
        ) : status === 'pending' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Clock className="h-10 w-10 text-amber-500" />
            <p className="text-sm font-medium">Solicitação pendente</p>
            <p className="text-xs text-muted-foreground text-center">
              Você já enviou uma solicitação para entrar no quadro <strong>{boardInfo?.name}</strong>. Aguarde a aprovação do administrador.
            </p>
          </div>
        ) : status === 'sent' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium">Solicitação enviada!</p>
            <p className="text-xs text-muted-foreground text-center">
              O administrador do quadro <strong>{boardInfo?.name}</strong> será notificado e poderá aprovar sua entrada.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus className="h-8 w-8 text-primary" />
            </div>
            {boardInfo && (
              <div className="text-center space-y-1">
                <p className="text-base font-semibold">{boardInfo.name}</p>
                {boardInfo.description && (
                  <p className="text-xs text-muted-foreground">{boardInfo.description}</p>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center mt-1">
              Deseja solicitar acesso a este quadro? O administrador será notificado.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {status === 'already_member' ? (
            <Button onClick={handleGoToBoard} className="flex-1">
              Ir para Tarefas
            </Button>
          ) : status === 'idle' ? (
            <>
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSendRequest} disabled={submitting} className="flex-1 gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Solicitar Acesso
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose} className="flex-1">
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
