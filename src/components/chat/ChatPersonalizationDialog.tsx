import { useEffect, useState } from 'react';
import { ImagePlus, Palette, RotateCcw, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export const CHAT_BACKGROUND_KEY_PREFIX = 'nuvexa:chat-background:';

export function getChatBackgroundKey(chatId: string) {
  return `${CHAT_BACKGROUND_KEY_PREFIX}${chatId}`;
}

interface ChatPersonalizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string | null;
  chatName?: string;
}

export function ChatPersonalizationDialog({ open, onOpenChange, chatId, chatName }: ChatPersonalizationDialogProps) {
  const [background, setBackground] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!open || !chatId) return;
    const saved = localStorage.getItem(getChatBackgroundKey(chatId)) || '';
    setBackground(saved);
    setUrl(saved.startsWith('data:') ? '' : saved);
  }, [open, chatId]);

  const emitChange = (value: string) => {
    if (!chatId) return;
    localStorage.setItem(getChatBackgroundKey(chatId), value);
    window.dispatchEvent(new CustomEvent('nuvexa:chat-background-changed', { detail: { chatId, background: value } }));
    setBackground(value);
  };

  const handleUpload = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => emitChange(String(reader.result || ''));
    reader.onerror = () => toast.error('Não foi possível carregar a imagem.');
    reader.readAsDataURL(file);
  };

  const handleUrl = () => {
    const value = url.trim();
    if (!value) {
      toast.error('Informe uma URL de imagem.');
      return;
    }
    emitChange(value);
    toast.success('Fundo do chat atualizado.');
  };

  const handleReset = () => {
    if (!chatId) return;
    localStorage.removeItem(getChatBackgroundKey(chatId));
    window.dispatchEvent(new CustomEvent('nuvexa:chat-background-changed', { detail: { chatId, background: '' } }));
    setBackground('');
    setUrl('');
    toast.success('Fundo padrão restaurado.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> Personalização do chat</DialogTitle>
          <DialogDescription>
            Personalize somente esta conversa. A escolha fica salva neste navegador e não altera o chat dos outros usuários.
          </DialogDescription>
        </DialogHeader>

        {!chatId ? (
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Selecione uma conversa individual para personalizar o fundo.</div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">{chatName || 'Conversa individual'}</p>
              <p className="text-xs text-muted-foreground">A personalização é exclusiva desta conversa.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chat-background-upload">Imagem de fundo</Label>
              <label htmlFor="chat-background-upload" className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-sm font-medium transition-colors hover:bg-muted/60">
                <Upload className="h-4 w-4" /> Escolher imagem do computador
              </label>
              <Input id="chat-background-upload" type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chat-background-url">Ou usar uma URL de imagem</Label>
              <div className="flex gap-2"><Input id="chat-background-url" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} /><Button type="button" onClick={handleUrl}>Aplicar</Button></div>
            </div>

            {background && (
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="flex h-32 items-center justify-center bg-cover bg-center" style={{ backgroundImage: `url(${background})` }}>
                  <div className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur">Pré-visualização</div>
                </div>
              </div>
            )}

            <Button type="button" variant="outline" className="w-full gap-2" onClick={handleReset}><RotateCcw className="h-4 w-4" /> Restaurar fundo padrão</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
