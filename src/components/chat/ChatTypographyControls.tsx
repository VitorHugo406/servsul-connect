import { useChatTypography } from '@/hooks/useChatTypography';
import { CHAT_FONTS, ChatTypography, DEFAULT_CHAT_TYPOGRAPHY } from '@/lib/chatTypography';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export function ChatTypographyControls() {
  const { value, key, className } = useChatTypography();
  const save = (next: ChatTypography) => {
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event('nuvexa:chat-typography')); } catch { return; }
  };
  const names = { system: 'Sistema', arial: 'Arial', georgia: 'Georgia', mono: 'Monoespaçada' };
  return <div className="space-y-4">
    <div className="space-y-2"><Label htmlFor="chat-font">Fonte das mensagens</Label><Select value={value.font} onValueChange={font => { if (CHAT_FONTS.includes(font as typeof value.font)) save({ ...value, font: font as typeof value.font }); }}><SelectTrigger id="chat-font"><SelectValue /></SelectTrigger><SelectContent>{CHAT_FONTS.map(font => <SelectItem key={font} value={font}>{names[font]}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-3"><Label htmlFor="chat-font-size">Tamanho do texto · {value.size}px</Label><Slider id="chat-font-size" aria-label="Tamanho do texto" min={12} max={24} step={1} value={[value.size]} onValueChange={([size]) => { if (size !== undefined) save({ ...value, size }); }} /></div>
    <div className={`${className} chat-bubble chat-bubble-outgoing w-fit`}><p className="chat-message-text">Olá! Tudo bem com você?</p></div>
    <Button variant="ghost" size="sm" className="gap-2" onClick={() => save(DEFAULT_CHAT_TYPOGRAPHY)}><RotateCcw className="h-4 w-4" /> Restaurar fonte</Button>
  </div>;
}