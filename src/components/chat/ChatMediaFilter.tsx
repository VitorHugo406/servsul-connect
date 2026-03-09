import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Link2, ImageIcon, Download, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatMediaFilterProps {
  chatType: 'sector' | 'direct' | 'group';
  chatId: string;
  profileId?: string; // for DMs, current user profile id
}

interface MediaItem {
  id: string;
  type: 'file' | 'link' | 'image';
  name: string;
  url: string;
  date: string;
  senderName?: string;
  fileSize?: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractLinksFromContent(content: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>\])"']+/g;
  return content.match(urlRegex) || [];
}

function extractImageUrlsFromContent(content: string): string[] {
  const urls = extractLinksFromContent(content);
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
  return urls.filter(u => {
    const lower = u.toLowerCase();
    return imageExts.some(ext => lower.includes(ext));
  });
}

function isImageFile(fileType: string): boolean {
  return fileType.startsWith('image/');
}

export function ChatMediaFilter({ chatType, chatId, profileId }: ChatMediaFilterProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('files');

  useEffect(() => {
    if (!chatId) return;
    fetchMedia();
  }, [chatId, chatType]);

  const fetchMedia = async () => {
    setLoading(true);
    const allItems: MediaItem[] = [];

    try {
      if (chatType === 'sector') {
        // Get messages from sector
        const { data: messages } = await supabase
          .from('messages')
          .select('id, content, created_at, author_id, profiles:author_id(name, display_name)')
          .eq('sector_id', chatId)
          .order('created_at', { ascending: false })
          .limit(500) as any;

        // Get attachments for these messages
        const messageIds = (messages || []).map((m: any) => m.id);
        if (messageIds.length > 0) {
          const { data: attachments } = await supabase
            .from('attachments')
            .select('*')
            .in('message_id', messageIds)
            .order('created_at', { ascending: false });

          for (const att of attachments || []) {
            const msg = (messages || []).find((m: any) => m.id === att.message_id);
            const senderName = msg?.profiles?.display_name || msg?.profiles?.name || '';
            allItems.push({
              id: att.id,
              type: isImageFile(att.file_type) ? 'image' : 'file',
              name: att.file_name,
              url: att.file_url,
              date: att.created_at,
              senderName,
              fileSize: att.file_size,
            });
          }
        }

        // Extract links from message content
        for (const msg of messages || []) {
          const senderName = msg.profiles?.display_name || msg.profiles?.name || '';
          const links = extractLinksFromContent(msg.content);
          const imageUrls = extractImageUrlsFromContent(msg.content);
          for (const link of links) {
            if (!imageUrls.includes(link)) {
              allItems.push({
                id: `link-${msg.id}-${link}`,
                type: 'link',
                name: link,
                url: link,
                date: msg.created_at,
                senderName,
              });
            }
          }
          for (const imgUrl of imageUrls) {
            allItems.push({
              id: `img-${msg.id}-${imgUrl}`,
              type: 'image',
              name: imgUrl.split('/').pop() || 'imagem',
              url: imgUrl,
              date: msg.created_at,
              senderName,
            });
          }
        }

      } else if (chatType === 'direct') {
        // Get DMs between two users
        const { data: messages } = await supabase
          .from('direct_messages')
          .select('id, content, created_at, sender_id, sender:sender_id(name, display_name)')
          .or(`and(sender_id.eq.${profileId},receiver_id.eq.${chatId}),and(sender_id.eq.${chatId},receiver_id.eq.${profileId})`)
          .order('created_at', { ascending: false })
          .limit(500) as any;

        const messageIds = (messages || []).map((m: any) => m.id);
        if (messageIds.length > 0) {
          const { data: attachments } = await supabase
            .from('attachments')
            .select('*')
            .in('direct_message_id', messageIds)
            .order('created_at', { ascending: false });

          for (const att of attachments || []) {
            const msg = (messages || []).find((m: any) => m.id === att.direct_message_id);
            const senderName = msg?.sender?.display_name || msg?.sender?.name || '';
            allItems.push({
              id: att.id,
              type: isImageFile(att.file_type) ? 'image' : 'file',
              name: att.file_name,
              url: att.file_url,
              date: att.created_at,
              senderName,
              fileSize: att.file_size,
            });
          }
        }

        for (const msg of messages || []) {
          const senderName = msg.sender?.display_name || msg.sender?.name || '';
          const links = extractLinksFromContent(msg.content);
          const imageUrls = extractImageUrlsFromContent(msg.content);
          for (const link of links) {
            if (!imageUrls.includes(link)) {
              allItems.push({
                id: `link-${msg.id}-${link}`,
                type: 'link',
                name: link,
                url: link,
                date: msg.created_at,
                senderName,
              });
            }
          }
          for (const imgUrl of imageUrls) {
            allItems.push({
              id: `img-${msg.id}-${imgUrl}`,
              type: 'image',
              name: imgUrl.split('/').pop() || 'imagem',
              url: imgUrl,
              date: msg.created_at,
              senderName,
            });
          }
        }

      } else if (chatType === 'group') {
        const { data: messages } = await supabase
          .from('private_group_messages')
          .select('id, content, created_at, sender_id, sender:sender_id(name, display_name)')
          .eq('group_id', chatId)
          .order('created_at', { ascending: false })
          .limit(500) as any;

        for (const msg of messages || []) {
          const senderName = msg.sender?.display_name || msg.sender?.name || '';
          const links = extractLinksFromContent(msg.content);
          const imageUrls = extractImageUrlsFromContent(msg.content);

          // Check for attachment URLs in content (supabase storage URLs containing /attachments/)
          const allUrls = extractLinksFromContent(msg.content);
          const storageUrls = allUrls.filter(u => u.includes('/storage/') && u.includes('/attachments/'));
          
          for (const storageUrl of storageUrls) {
            const fileName = decodeURIComponent(storageUrl.split('/').pop() || 'arquivo');
            const isImg = extractImageUrlsFromContent(storageUrl).length > 0;
            allItems.push({
              id: `storage-${msg.id}-${storageUrl}`,
              type: isImg ? 'image' : 'file',
              name: fileName,
              url: storageUrl,
              date: msg.created_at,
              senderName,
            });
          }

          for (const link of links) {
            if (storageUrls.includes(link) || imageUrls.includes(link)) continue;
            allItems.push({
              id: `link-${msg.id}-${link}`,
              type: 'link',
              name: link,
              url: link,
              date: msg.created_at,
              senderName,
            });
          }
          for (const imgUrl of imageUrls) {
            if (storageUrls.includes(imgUrl)) continue;
            allItems.push({
              id: `img-${msg.id}-${imgUrl}`,
              type: 'image',
              name: imgUrl.split('/').pop() || 'imagem',
              url: imgUrl,
              date: msg.created_at,
              senderName,
            });
          }
        }
      }
    } catch (e) {
      console.error('Error fetching media:', e);
    }

    setItems(allItems);
    setLoading(false);
  };

  const files = items.filter(i => i.type === 'file');
  const links = items.filter(i => i.type === 'link');
  const images = items.filter(i => i.type === 'image');

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderEmpty = (label: string) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 rounded-full bg-muted p-3">
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">Nenhum {label} encontrado</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="files" className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" />
            Arquivos ({files.length})
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-1.5 text-xs">
            <Link2 className="h-3.5 w-3.5" />
            Links ({links.length})
          </TabsTrigger>
          <TabsTrigger value="images" className="gap-1.5 text-xs">
            <ImageIcon className="h-3.5 w-3.5" />
            Fotos ({images.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          <ScrollArea className="max-h-[400px]">
            {files.length === 0 ? renderEmpty('arquivo') : (
              <div className="space-y-1">
                {files.map(f => (
                  <a
                    key={f.id}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {f.senderName && `${f.senderName} • `}{formatDate(f.date)}{f.fileSize ? ` • ${formatFileSize(f.fileSize)}` : ''}
                      </p>
                    </div>
                    <Download className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="links">
          <ScrollArea className="max-h-[400px]">
            {links.length === 0 ? renderEmpty('link') : (
              <div className="space-y-1">
                {links.map(l => (
                  <a
                    key={l.id}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 flex-shrink-0">
                      <Link2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-primary">{l.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {l.senderName && `${l.senderName} • `}{formatDate(l.date)}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="images">
          <ScrollArea className="max-h-[400px]">
            {images.length === 0 ? renderEmpty('foto') : (
              <div className="grid grid-cols-3 gap-1.5">
                {images.map(img => (
                  <a
                    key={img.id}
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square rounded-lg overflow-hidden bg-muted group"
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </a>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
