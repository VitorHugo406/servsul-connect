import { htmlToText } from '@/lib/safeHtml';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Note, useNotes } from '@/hooks/useNotes';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ListSkeleton } from '@/components/ui/skeletons';
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
import { appConfirm } from '@/lib/appDialog';
import { mergeNoteHtml } from '@/lib/noteMerge';
import { Eye } from 'lucide-react';

function stripHtml(html: string) {
  return htmlToText(html);
}

export function NotesSection() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { notes, loading, createNote, updateNote, saveContent, deleteNote } = useNotes();
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
      <div className="dk-pg nt-pg">
        {/* Sidebar de notas */}
        <aside className={cn('nt-side', isMobile && selected && 'hidden')}>
          <div className="nt-side-hd">
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
              {loading && <ListSkeleton rows={6} className="p-1" />}
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
                    className={cn('nt-item', selectedId === n.id && 'nt-sel')}
                    style={{
                      background: n.background_color,
                      backgroundImage: bgImage,
                      backgroundSize: n.background_texture ? getTextureSize(n.background_texture) : 'cover',
                    }}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      {n.is_pinned && <Pin className="h-3 w-3 text-foreground/70" />}
                      <p className="font-semibold text-sm text-foreground/90 truncate flex-1">{n.title}</p>
                      {isShared && <span className="nt-badge" title={n.my_permission === 'read' ? 'Compartilhada com você · só visualização' : 'Compartilhada com você · pode editar'}>{n.my_permission === 'read' ? <Eye className="h-3 w-3" /> : <Users className="h-3 w-3" />}</span>}
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
        <main className={cn('nt-main', isMobile && !selected && 'hidden')}>
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
              onChange={(patch) => { void updateNote(selected.id, patch); }}
              saveContent={saveContent}
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
  saveContent: (id: string, base: string, local: string) => Promise<string | null>;
  onDelete: () => void;
  onShare: () => void;
  onOpenFloating: (preferred: 'internal' | 'pip') => void;
  isMobile: boolean;
  onBack: () => void;
}

function NoteEditor({ note, isOwner, onChange, saveContent, onDelete, onShare, onOpenFloating, isMobile, onBack }: EditorProps) {
  // Permission comes with the note list (refreshed in realtime when the owner changes it).
  const canEdit = note.my_permission ? note.my_permission !== 'read' : isOwner;

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [syncKey, setSyncKey] = useState(0);
  const contentRef = useRef(note.content);      // what the editor shows now
  const baseRef = useRef(note.content);         // last server text the local copy is based on
  const pendingRef = useRef(false);             // local changes not saved yet
  const savingRef = useRef(false);
  const timer = useRef<number | null>(null);
  const noteIdRef = useRef(note.id);

  const show = (html: string) => { contentRef.current = html; setContent(html); setSyncKey((k) => k + 1); };

  useEffect(() => setTitle(note.title), [note.id, note.title]);
  // Another note opened: start from its server text.
  useEffect(() => { noteIdRef.current = note.id; baseRef.current = note.content; pendingRef.current = false; show(note.content); }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // A co-author saved: apply it right away when I'm not in the middle of an unsaved edit (my next save merges otherwise).
  useEffect(() => {
    if (note.content === baseRef.current || note.content === contentRef.current) { baseRef.current = note.content; return; }
    if (!pendingRef.current && !savingRef.current) { baseRef.current = note.content; show(note.content); }
  }, [note.content]);

  const doSave = async () => {
    if (!canEdit || savingRef.current || !pendingRef.current) return;
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    savingRef.current = true; pendingRef.current = false;
    const id = noteIdRef.current, sent = contentRef.current;
    const stored = await saveContent(id, baseRef.current, sent);
    savingRef.current = false;
    if (noteIdRef.current !== id) return;
    if (stored === null) { pendingRef.current = true; return; }
    const now = contentRef.current;
    baseRef.current = stored;
    if (now === sent) { if (stored !== sent) show(stored); }
    else {
      // I kept typing while it saved: fold my newest edits onto what was stored.
      const merged = mergeNoteHtml(sent, now, stored);
      if (merged !== now) show(merged);
      if (merged !== stored) { pendingRef.current = true; schedule(); }
    }
  };
  const saveRef = useRef(doSave); saveRef.current = doSave;
  const schedule = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { void saveRef.current(); }, 600); };

  const handleContentChange = (html: string) => {
    if (!canEdit) return;
    contentRef.current = html; setContent(html); pendingRef.current = true; schedule();
  };

  // Save on note change / unmount / tab hide / page unload.
  useEffect(() => () => { void saveRef.current(); }, [note.id]);
  useEffect(() => {
    const onHide = () => { void saveRef.current(); };
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => { window.removeEventListener('beforeunload', onHide); document.removeEventListener('visibilitychange', onHide); };
  }, []);

  const bgImage = [getImageCss(note.background_image), getTextureCss(note.background_texture)].filter(Boolean).join(', ');
  const supportsPip = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  return (
    <div
      className="nt-ed"
      style={{
        background: note.background_color,
        backgroundImage: bgImage,
        backgroundSize: note.background_texture ? getTextureSize(note.background_texture) : 'cover',
      }}
    >
      <div className="nt-bar">
        {isMobile && (
          <Button size="sm" variant="ghost" onClick={onBack}>Voltar</Button>
        )}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => canEdit && title !== note.title && onChange({ title: title || 'Sem título' })}
          readOnly={!canEdit}
          placeholder="Título"
          className="nt-title flex-1 min-w-[180px] text-base font-semibold focus-visible:ring-0"
        />
        {!canEdit ? <span className="nt-ro"><Eye className="h-3.5 w-3.5" /> Somente visualização</span> : null}

        {canEdit ? (<>
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

        </>) : null}

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
                onClick={async () => {
                  if (await appConfirm({ title: 'Excluir esta anotação?', message: 'Esta ação não pode ser desfeita.', confirmText: 'Excluir', danger: true })) onDelete();
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Excluir</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="nt-body">
        <RichTextEditor
          value={content}
          syncKey={syncKey}
          onChange={handleContentChange}
          onImmediateSave={(html) => { if (!canEdit) return; contentRef.current = html; pendingRef.current = true; void saveRef.current(); }}
          placeholder="Escreva sua anotação..."
          readOnly={!canEdit}
        />
      </div>
    </div>
  );
}

