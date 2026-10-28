import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Smile, Paperclip, Image as ImageIcon, X, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useFileUpload } from '@/hooks/useFileUpload';
import { CardMentionPicker, formatCardMention } from './CardMentionPicker';
import { UserMentionPicker } from './UserMentionPicker';
import { FormattingPreview } from './FormattingPreview';

interface Attachment { file: File; preview?: string; }
interface ReplyTo { id: string; content: string; author?: { name: string; display_name: string | null } | null; }
interface ChatInputProps {
  onSendMessage: (message: string, attachments?: { url: string; fileName: string; fileType: string; fileSize: number }[], replyToId?: string) => void;
  hideAttachment?: boolean;
  onTyping?: () => void;
  onMention?: (userId: string, userName: string) => void;
  replyTo?: ReplyTo | null;
  onClearReply?: () => void;
}

const EMOJI_LIST = ['😀', '😂', '😍', '🤔', '👍', '👏', '🎉', '🔥', '❤️', '✅', '🚀', '💪', '😊', '👋', '🙏', '💡'];

export function ChatInput({ onSendMessage, hideAttachment = false, onTyping, onMention, replyTo, onClearReply }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [cardQuery, setCardQuery] = useState('');
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading, limitReached, weeklyLimit, isMainAdmin } = useFileUpload();
  const effectiveLimitReached = limitReached && !isMainAdmin;

  const handleSubmit = useCallback(async () => {
    if (isSending) return;
    const trimmedMessage = message.trim();
    if (!trimmedMessage && attachments.length === 0) return;

    setIsSending(true);
    const currentMessage = trimmedMessage;
    const currentAttachments = [...attachments];
    setShowCardPicker(false);

    try {
      const uploadedAttachments: { url: string; fileName: string; fileType: string; fileSize: number }[] = [];
      for (const attachment of currentAttachments) {
        setUploadingFileName(attachment.file.name);
        setUploadProgress(0);
        const result = await uploadFile(attachment.file, 'attachments', setUploadProgress);
        if (!result) {
          toast.error(`Não foi possível enviar "${attachment.file.name}". O arquivo continua anexado para tentar novamente.`);
          return;
        }
        uploadedAttachments.push(result);
      }

      await onSendMessage(currentMessage, uploadedAttachments.length > 0 ? uploadedAttachments : undefined, replyTo?.id);
      setMessage('');
      setAttachments(prev => {
        prev.forEach(item => { if (item.preview) URL.revokeObjectURL(item.preview); });
        return [];
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Não foi possível concluir o envio. Confira a conexão e tente novamente.');
    } finally {
      setUploadingFileName(null);
      setUploadProgress(0);
      setIsSending(false);
    }
  }, [message, attachments, isSending, uploadFile, onSendMessage, replyTo?.id]);

  const handleEmojiSelect = (emoji: string) => { setMessage(prev => prev + emoji); setShowEmojiPicker(false); inputRef.current?.focus(); };
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); if (!showCardPicker && !showUserPicker) handleSubmit(); }
    if (e.key === 'Escape') { if (showCardPicker) setShowCardPicker(false); if (showUserPicker) setShowUserPicker(false); }
  }, [handleSubmit, showCardPicker, showUserPicker]);
  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current; if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = 20 * 5 + 12;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);
  useEffect(() => { adjustTextareaHeight(); }, [message, adjustTextareaHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val); onTyping?.();
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPos);
    const hashMatch = textBeforeCursor.match(/#(\w*)$/);
    if (hashMatch) { setShowCardPicker(true); setCardQuery(hashMatch[1]); } else { setShowCardPicker(false); setCardQuery(''); }
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) { setShowUserPicker(true); setUserQuery(atMatch[1]); } else { setShowUserPicker(false); setUserQuery(''); }
  };
  const handleUserSelect = (user: { id: string; name: string; display_name: string | null }) => {
    const displayName = user.display_name || user.name;
    const cursorPos = inputRef.current?.selectionStart || message.length;
    const textBeforeCursor = message.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    setMessage(message.substring(0, atIndex) + `@${displayName} ` + message.substring(cursorPos));
    setShowUserPicker(false); setUserQuery(''); inputRef.current?.focus(); onMention?.(user.id, displayName);
  };
  const handleCardSelect = (task: any) => {
    const mention = formatCardMention(task);
    const cursorPos = inputRef.current?.selectionStart || message.length;
    const textBeforeCursor = message.substring(0, cursorPos);
    const hashIndex = textBeforeCursor.lastIndexOf('#');
    setMessage(message.substring(0, hashIndex) + mention + message.substring(cursorPos));
    setShowCardPicker(false); setCardQuery(''); inputRef.current?.focus();
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) { const file = files[i]; newAttachments.push({ file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined }); }
    setAttachments(prev => [...prev, ...newAttachments]); e.target.value = '';
  };
  const removeAttachment = (index: number) => {
    setAttachments(prev => { const next = [...prev]; if (next[index]?.preview) URL.revokeObjectURL(next[index].preview!); next.splice(index, 1); return next; });
  };

  return <div className="relative z-20 shrink-0 border-t border-border/30 bg-transparent px-2 pt-1.5 backdrop-blur-xl sm:px-4 sm:pt-2" style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }} onSubmit={e => e.preventDefault()}>
    {replyTo && <div className="mb-1.5 flex items-start gap-2 rounded-lg border-l-2 border-primary bg-muted/60 px-3 py-1.5"><div className="min-w-0 flex-1"><span className="text-xs font-semibold text-primary">{replyTo.author?.display_name || replyTo.author?.name || 'Usuário'}</span><p className="truncate text-xs text-muted-foreground">{replyTo.content.substring(0, 120)}</p></div><button onClick={onClearReply} className="flex-shrink-0 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div>}
    {showCardPicker && <CardMentionPicker query={cardQuery} onSelect={handleCardSelect} onClose={() => setShowCardPicker(false)} />}
    {showUserPicker && <UserMentionPicker query={userQuery} onSelect={handleUserSelect} onClose={() => setShowUserPicker(false)} />}
    <FormattingPreview text={message} />
    <AnimatePresence>{attachments.length > 0 && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-2 flex flex-col gap-1.5">{attachments.map((attachment, index) => { const isCurrentUpload = isSending && uploadingFileName === attachment.file.name; const isQueued = isSending && !isCurrentUpload; return <div key={attachment.file.name + '-' + attachment.file.size + '-' + index} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/60 bg-card/75 px-3 py-2 shadow-sm backdrop-blur-xl"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">{attachment.preview ? <img src={attachment.preview} alt={attachment.file.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-xl bg-primary/10 text-primary"><FileText className="h-4 w-4" /><span className="max-w-full truncate px-1 text-[8px] font-bold uppercase">{attachment.file.name.split(".").pop()?.slice(0, 5) || "ARQ"}</span></div>}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-foreground">{attachment.file.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{(attachment.file.size / 1024 / 1024).toFixed(2)} MB · {isCurrentUpload ? 'Enviando arquivo…' : isQueued ? 'Na fila de envio' : 'Pronto para enviar'}</p>{isCurrentUpload && <div className="mt-1.5"><div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground"><span>Enviando</span><span className="font-semibold tabular-nums text-primary">{uploadProgress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted/80"><div className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out" style={{ width: `${uploadProgress}%` }} /></div></div>}</div>{isCurrentUpload || isQueued ? <Loader2 className={`h-4 w-4 shrink-0 ${isCurrentUpload ? 'animate-spin text-primary' : 'text-muted-foreground/60'}`} /> : <button type="button" disabled={isSending} onClick={() => removeAttachment(index)} aria-label={`Remover ${attachment.file.name}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"><X className="h-4 w-4" /></button>}</div>; })}</motion.div>}</AnimatePresence>
    <AnimatePresence>{showEmojiPicker && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute bottom-full left-2 z-40 mb-2 max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-card p-2 shadow-xl sm:left-4"><div className="flex max-w-[min(360px,calc(100vw-2rem))] gap-1 overflow-x-auto scrollbar-none">{EMOJI_LIST.map(emoji => <button key={emoji} type="button" onClick={() => handleEmojiSelect(emoji)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl transition-colors hover:bg-muted">{emoji}</button>)}</div></motion.div>}</AnimatePresence>
    <div className="relative z-10 flex items-center gap-1 rounded-[26px] border border-border/50 bg-muted/35 p-1 shadow-[0_8px_24px_-18px_hsl(var(--foreground)/0.45),inset_0_1px_0_hsl(var(--background)/0.9)] backdrop-blur-2xl transition-all focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 sm:gap-1.5">
      <div className="flex shrink-0 items-center gap-0.5">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:bg-background/70 hover:text-foreground sm:h-9 sm:w-9" onClick={() => setShowEmojiPicker(!showEmojiPicker)}><Smile className="h-4 w-4 sm:h-5 sm:w-5" /></Button>
        {!hideAttachment && <><Button type="button" variant="ghost" size="icon" className={`h-8 w-8 rounded-full sm:h-9 sm:w-9 ${effectiveLimitReached ? 'cursor-not-allowed text-muted-foreground/40' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => { if (effectiveLimitReached) { toast.error(`Limite semanal de ${weeklyLimit} arquivos atingido. Tente novamente na próxima semana.`); return; } fileInputRef.current?.click(); }} disabled={uploading}><Paperclip className="h-4 w-4 sm:h-5 sm:w-5" /></Button><Button type="button" variant="ghost" size="icon" className={`h-8 w-8 rounded-full sm:h-9 sm:w-9 ${effectiveLimitReached ? 'cursor-not-allowed text-muted-foreground/40' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => { if (effectiveLimitReached) { toast.error(`Limite semanal de ${weeklyLimit} arquivos atingido. Tente novamente na próxima semana.`); return; } imageInputRef.current?.click(); }} disabled={uploading}><ImageIcon className="h-4 w-4 sm:h-5 sm:w-5" /></Button></>}
      </div>
      <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.txt" className="hidden" onChange={handleFileSelect} /><input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
      <div className="min-w-0 flex-1"><textarea ref={inputRef} value={message} onChange={handleChange} onKeyDown={handleKeyDown} placeholder="Mensagem..." rows={1} style={{ overflow: 'hidden' }} className="w-full resize-none border-0 bg-transparent px-2 py-1.5 text-[15px] leading-5 placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0 sm:text-sm" /></div>
      <Button type="button" onClick={handleSubmit} disabled={(!message.trim() && attachments.length === 0) || uploading || isSending} className="h-8 w-8 shrink-0 rounded-full gradient-primary p-0 shadow-md transition-all hover:scale-105 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:hover:scale-100 sm:h-9 sm:w-9"><Send className="h-4 w-4" /></Button>
    </div>
  </div>;
}
