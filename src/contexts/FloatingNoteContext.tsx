import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Note } from '@/hooks/useNotes';

interface FloatingNoteContextType {
  floatingNote: Note | null;
  mode: 'internal' | 'pip' | null;
  openFloating: (note: Note, preferred: 'internal' | 'pip') => Promise<void>;
  closeFloating: () => void;
  updateFloatingNote: (note: Note) => void;
}

const FloatingNoteContext = createContext<FloatingNoteContextType | null>(null);

export function FloatingNoteProvider({ children }: { children: ReactNode }) {
  const [floatingNote, setFloatingNote] = useState<Note | null>(null);
  const [mode, setMode] = useState<'internal' | 'pip' | null>(null);
  const pipWindowRef = useRef<Window | null>(null);

  const closeFloating = () => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
    }
    pipWindowRef.current = null;
    setFloatingNote(null);
    setMode(null);
  };

  const openFloating = async (note: Note, preferred: 'internal' | 'pip') => {
    if (preferred === 'pip' && 'documentPictureInPicture' in window) {
      try {
        const pip = await (window as any).documentPictureInPicture.requestWindow({
          width: 360,
          height: 480,
        });
        pipWindowRef.current = pip;
        // Copia estilos atuais
        document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
          pip.document.head.appendChild(node.cloneNode(true));
        });
        pip.document.body.style.margin = '0';
        pip.document.title = note.title || 'Anotação';
        pip.addEventListener('pagehide', () => {
          pipWindowRef.current = null;
          setFloatingNote(null);
          setMode(null);
        });
        setFloatingNote(note);
        setMode('pip');
        return;
      } catch (err) {
        console.warn('PiP indisponível, usando janela interna', err);
      }
    }
    setFloatingNote(note);
    setMode('internal');
  };

  const updateFloatingNote = (note: Note) => {
    setFloatingNote(note);
  };

  useEffect(() => {
    return () => {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
      }
    };
  }, []);

  return (
    <FloatingNoteContext.Provider value={{ floatingNote, mode, openFloating, closeFloating, updateFloatingNote }}>
      {children}
    </FloatingNoteContext.Provider>
  );
}

export function useFloatingNote() {
  const ctx = useContext(FloatingNoteContext);
  if (!ctx) throw new Error('useFloatingNote must be used within FloatingNoteProvider');
  return ctx;
}

export function getPipWindow(): Window | null {
  // Helper to find an open documentPictureInPicture window if any
  return (window as any).documentPictureInPicture?.window || null;
}
