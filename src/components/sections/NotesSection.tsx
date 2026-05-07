import { useEffect, useMemo, useRef, useState } from 'react';
import { Note, useNotes, useMyNotePermission } from '@/hooks/useNotes';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Pin,
  PinOff,
  Trash2,
  Share2,
  Archive,
  ArchiveRestore,
  PictureInPicture2,
  PanelRightOpen,
  Search,
  Image as ImageIcon,
  Palette,
  Layers,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RichTextEditor } from '@/components/notes/RichTextEditor';
import { NOTE_BACKGROUND_IMAGES, NOTE_COLORS, NOTE_TEXTURES, getImageCss, getTextureCss, getTextureSize } from '@/components/notes/noteStyles';
import { NoteShareDialog } from '@/components/notes/NoteShareDialog';
import { useFloatingNote } from '@/contexts/FloatingNoteContext';
import { useIsMobile } from '@/hooks/use-mobile';

function stripHtml(html: string) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

export function NotesSection() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { notes, loading, createNote, updateNote, deleteNote } = useNotes();
  const { floatingNote, openFloating, closeFloating } = useFloatingNote();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const visibleNotes = useMemo(() => {
    return notes.filter((n) => {
      if (n.is_archived !== showArchived) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        stripHtml(n.content).toLowerCase().includes(q)
      );
    });
  }, [notes, search, showArchived]);

  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId) || null,
    [notes, selectedId],
  );

  useEffect(() => {
    if (!selected && visibleNotes.length > 0) {
      setSelectedId(visibleNotes[0].id);
    }
  }, [visibleNotes, selected]);

  const isOwner = selected ? selected.owner_id === user?.id : false;
  const isFloatingThis = floatingNote?.id === selected?.id;

  const handleCreate = async () => {
    const n = await createNote();
    if (n) setSelectedId(n.id);
  };

  const handleOpenFloating = async (preferred: 'internal' | 'pip') => {
    if (!selected) return;
    await openFloating(selected, preferred);
  };

  return (
    <TooltipProvider>
      <div className="flex h-full overflow-hidden">
        {/* Sidebar de notas */}
        <aside className={cn(
          'flex w-80 flex-col border-r border-border bg-muted/30',
          isMobile && selected && 'hidden',
        )}>
          <div className="border-b border-border p-3 space-y-2">
            <Button onClick={handleCreate} className="w-full gap-2">
              <Plus className="h-4 w-4" /> Nova anotação
            </Button>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={!showArchived ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setShowArchived(false)}
              >
                Ativas
              </Button>
              <Button
                size="sm"
                variant={showArchived ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setShowArchived(true)}
              >
                <Archive className="h-3.5 w-3.5 mr-1" /> Arquivadas
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loading && <p className="text-xs text-muted-foreground p-3">Carregando...</p>}
              {!loading && visibleNotes.length === 0 && (
                <p className="text-xs text-muted-foreground p-3 text-center">
                  {showArchived ? 'Sem anotações arquivadas' : 'Crie sua primeira anotação'}
                </p>
              )}
              {visibleNotes.map((n) => {
                const isShared = n.owner_id !== user?.id;
                const bgImage = [getImageCss(n.background_image), getTextureCss(n.background_texture)].filter(Boolean).join(', ');
                return (
                  <button
                    key={n.id}
                    onClick={() => setSelectedId(n.id)}
                    className={cn(
                      'w-full text-left rounded-lg border p-3 transition-all hover:shadow-md',
                      selectedId === n.id ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                    )}
                    style={{
                      background: n.background_color,
                      backgroundImage: bgImage,
                      backgroundSize: n.background_texture ? getTextureSize(n.background_texture) : 'cover',
                    }}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      {n.is_pinned && <Pin className="h-3 w-3 text-foreground/70" />}
                      <p className="font-semibold text-sm text-foreground/90 truncate flex-1">{n.title}</p>
                      {isShared && <Users className="h-3 w-3 text-foreground/60" />}
                    </div>
                    <p className="text-xs text-foreground/60 line-clamp-2">
                      {stripHtml(n.content) || 'Sem conteúdo'}
                    </p>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        {/* Editor principal */}
        <main className={cn('flex-1 flex flex-col overflow-hidden', isMobile && !selected && 'hidden')}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>Selecione ou crie uma anotação</p>
            </div>
          ) : isFloatingThis ? (
            // Estado escurecido: nota está aberta em janela flutuante
            <div className="flex-1 flex items-center justify-center bg-muted/50 backdrop-blur-sm">
              <div className="text-center max-w-md p-8 rounded-2xl border border-border bg-background/80 shadow-lg">
                <PictureInPicture2 className="h-16 w-16 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-2">Janela em segundo plano</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Esta anotação está sendo editada em uma janela flutuante. Feche-a para continuar editando aqui.
                </p>
                <Button onClick={closeFloating} variant="outline">
                  Trazer de volta
                </Button>
              </div>
            </div>
          ) : (
            <NoteEditor
              note={selected}
              isOwner={isOwner}
              onChange={(patch) => updateNote(selected.id, patch)}
              onDelete={() => {
                deleteNote(selected.id);
                setSelectedId(null);
              }}
              onShare={() => setShareOpen(true)}
              onOpenFloating={handleOpenFloating}
              isMobile={isMobile}
              onBack={() => setSelectedId(null)}
            />
          )}
        </main>

        <NoteShareDialog open={shareOpen} onOpenChange={setShareOpen} noteId={isOwner ? selected?.id || null : null} />
      </div>
    </TooltipProvider>
  );
}

// ===== Editor =====
interface EditorProps {
  note: Note;
  isOwner: boolean;
  onChange: (patch: Partial<Note>) => void;
  onDelete: () => void;
  onShare: () => void;
  onOpenFloating: (preferred: 'internal' | 'pip') => void;
  isMobile: boolean;
  onBack: () => void;
}

function NoteEditor({ note, isOwner, onChange, onDelete, onShare, onOpenFloating, isMobile, onBack }: EditorProps) {
  const permission = useMyNotePermission(note);
  const canEdit = permission === 'owner' || permission === 'edit';

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const contentTimer = useRef<number | null>(null);
  const pendingContent = useRef<string | null>(null);

  useEffect(() => setTitle(note.title), [note.id, note.title]);
  useEffect(() => { setContent(note.content); pendingContent.current = null; }, [note.id]);

  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    if (contentTimer.current) { window.clearTimeout(contentTimer.current); contentTimer.current = null; }
    if (pendingContent.current !== null) {
      onChange({ content: pendingContent.current });
      pendingContent.current = null;
    }
  };

  const handleContentChange = (html: string) => {
    setContent(html);
    pendingContent.current = html;
    if (contentTimer.current) window.clearTimeout(contentTimer.current);
    contentTimer.current = window.setTimeout(() => {
      if (pendingContent.current !== null) {
        onChange({ content: pendingContent.current });
        pendingContent.current = null;
      }
    }, 500);
  };

  // Flush on unmount, on note change, on tab hide, on beforeunload
  useEffect(() => () => { flushRef.current(); }, []);
  useEffect(() => () => { flushRef.current(); }, [note.id]);
  useEffect(() => {
    const onHide = () => flushRef.current();
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  const bgImage = [getImageCss(note.background_image), getTextureCss(note.background_texture)].filter(Boolean).join(', ');
  const supportsPip = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        background: note.background_color,
        backgroundImage: bgImage,
        backgroundSize: note.background_texture ? getTextureSize(note.background_texture) : 'cover',
      }}
    >
      <div className="flex items-center gap-2 border-b border-border/40 bg-background/60 backdrop-blur p-2 flex-wrap">
        {isMobile && (
          <Button size="sm" variant="ghost" onClick={onBack}>Voltar</Button>
        )}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== note.title && onChange({ title: title || 'Sem título' })}
          placeholder="Título"
          className="flex-1 min-w-[180px] border-0 bg-transparent text-base font-semibold focus-visible:ring-0"
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={() => onChange({ is_pinned: !note.is_pinned })}>
              {note.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{note.is_pinned ? 'Desafixar' : 'Fixar'}</TooltipContent>
        </Tooltip>

        {/* Cor */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost"><Palette className="h-4 w-4" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-4 gap-2">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.value}
                  className="h-8 w-8 rounded border border-border"
                  style={{ background: c.value }}
                  title={c.name}
                  onClick={() => onChange({ background_color: c.value })}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Textura */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost"><Layers className="h-4 w-4" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2">
            <div className="space-y-1">
              {NOTE_TEXTURES.map((t) => (
                <button
                  key={t.value}
                  className="block w-full text-left rounded p-2 text-sm hover:bg-accent"
                  onClick={() => onChange({ background_texture: t.value === 'none' ? null : t.value })}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Imagem */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost"><ImageIcon className="h-4 w-4" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2">
            <div className="grid grid-cols-2 gap-2">
              {NOTE_BACKGROUND_IMAGES.map((img) => (
                <button
                  key={img.value}
                  className="h-14 rounded border border-border text-xs font-medium text-white shadow"
                  style={{ background: img.css || 'hsl(var(--muted))' }}
                  onClick={() => onChange({ background_image: img.value === 'none' ? null : img.value })}
                >
                  {img.value === 'none' ? <span className="text-foreground">Nenhuma</span> : img.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Janela flutuante (só desktop) */}
        {!isMobile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" title="Abrir em janela flutuante">
                <PictureInPicture2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {supportsPip && (
                <DropdownMenuItem onClick={() => onOpenFloating('pip')}>
                  <PictureInPicture2 className="h-4 w-4 mr-2" />
                  Janela do navegador (PiP)
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onOpenFloating('internal')}>
                <PanelRightOpen className="h-4 w-4 mr-2" />
                Janela flutuante interna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {isOwner && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={onShare}>
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Compartilhar</TooltipContent>
          </Tooltip>
        )}

        {isOwner && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={() => onChange({ is_archived: !note.is_archived })}>
                {note.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{note.is_archived ? 'Desarquivar' : 'Arquivar'}</TooltipContent>
          </Tooltip>
        )}

        {isOwner && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (confirm('Excluir esta anotação?')) onDelete();
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Excluir</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        <RichTextEditor
          value={content}
          onChange={handleContentChange}
          placeholder="Escreva sua anotação..."
          readOnly={!canEdit}
        />
      </div>
    </div>
  );
}

