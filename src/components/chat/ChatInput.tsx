import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Smile, Paperclip, Image as ImageIcon, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useFileUpload } from '@/hooks/useFileUpload';
import { CardMentionPicker, formatCardMention } from './CardMentionPicker';
import { FormattingPreview } from './FormattingPreview';

interface Attachment {
  file: File;
  preview?: string;
}

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: { url: string; fileName: string; fileType: string; fileSize: number }[]) => void;
  hideAttachment?: boolean;
}

const EMOJI_LIST = ['😀', '😂', '😍', '🤔', '👍', '👏', '🎉', '🔥', '❤️', '✅', '🚀', '💪', '😊', '👋', '🙏', '💡'];

export function ChatInput({ onSendMessage, hideAttachment = false }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [cardQuery, setCardQuery] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading, isImage } = useFileUpload();

  const handleSubmit = useCallback(async () => {
    if (isSending) return;
    const trimmedMessage = message.trim();
    if (!trimmedMessage && attachments.length === 0) return;

    setIsSending(true);
    const currentMessage = trimmedMessage;
    const currentAttachments = [...attachments];
    setMessage('');
    setAttachments([]);
    setShowCardPicker(false);

    try {
      const uploadedAttachments = [];
      for (const attachment of currentAttachments) {
        const result = await uploadFile(attachment.file);
        if (result) uploadedAttachments.push(result);
      }
      await onSendMessage(currentMessage, uploadedAttachments.length > 0 ? uploadedAttachments : undefined);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  }, [message, attachments, isSending, uploadFile, onSendMessage]);

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (!showCardPicker) handleSubmit();
    }
    if (e.key === 'Escape' && showCardPicker) {
      setShowCardPicker(false);
    }
  }, [handleSubmit, showCardPicker]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);

    // Detect # trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPos);
    const hashMatch = textBeforeCursor.match(/#(\w*)$/);
    if (hashMatch) {
      setShowCardPicker(true);
      setCardQuery(hashMatch[1]);
    } else {
      setShowCardPicker(false);
      setCardQuery('');
    }
  };

  const handleCardSelect = (task: any) => {
    const mention = formatCardMention(task);
    // Replace the #query with the formatted mention
    const cursorPos = inputRef.current?.selectionStart || message.length;
    const textBeforeCursor = message.substring(0, cursorPos);
    const hashIndex = textBeforeCursor.lastIndexOf('#');
    const before = message.substring(0, hashIndex);
    const after = message.substring(cursorPos);
    setMessage(before + mention + after);
    setShowCardPicker(false);
    setCardQuery('');
    inputRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      newAttachments.push({ file, preview });
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const newAttachments = [...prev];
      if (newAttachments[index].preview) URL.revokeObjectURL(newAttachments[index].preview!);
      newAttachments.splice(index, 1);
      return newAttachments;
    });
  };

  return (
    <div className="relative border-t border-border bg-card p-4" onSubmit={(e) => e.preventDefault()}>
      {/* Card Mention Picker */}
      {showCardPicker && (
        <CardMentionPicker
          query={cardQuery}
          onSelect={handleCardSelect}
          onClose={() => setShowCardPicker(false)}
        />
      )}

      {/* Formatting Preview */}
      <FormattingPreview text={message} />

      {/* Attachments preview */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 flex flex-wrap gap-2"
          >
            {attachments.map((attachment, index) => (
              <div key={index} className="relative group rounded-lg border border-border bg-muted/50 p-2">
                {attachment.preview ? (
                  <img src={attachment.preview} alt={attachment.file.name} className="h-16 w-16 rounded object-cover" />
                ) : (
                  <div className="flex h-16 w-16 flex-col items-center justify-center gap-1">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground truncate w-14 text-center">
                      {attachment.file.name.split('.').pop()?.toUpperCase()}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simple Emoji Picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-4 mb-2 z-50 bg-card border border-border rounded-xl shadow-lg p-3"
          >
            <div className="grid grid-cols-8 gap-2">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmojiSelect(emoji)}
                  className="text-xl hover:bg-muted rounded p-1 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2">
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Button
            type="button" variant="ghost" size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-foreground"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile className="h-5 w-5" />
          </Button>
          {!hideAttachment && (
            <>
              <Button type="button" variant="ghost" size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-foreground"
                onClick={() => fileInputRef.current?.click()} disabled={uploading}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button type="button" variant="ghost" size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-foreground"
                onClick={() => imageInputRef.current?.click()} disabled={uploading}
              >
                <ImageIcon className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>

        <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.txt" className="hidden" onChange={handleFileSelect} />
        <input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />

        <div className="flex-1 min-w-0">
          <textarea
            ref={inputRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder='Digite sua mensagem... (use # para mencionar cards)'
            rows={1}
            className="w-full resize-none rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={(!message.trim() && attachments.length === 0) || uploading || isSending}
          className="h-10 w-10 flex-shrink-0 rounded-xl gradient-primary p-0 shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
