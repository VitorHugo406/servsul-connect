// Slack-like PDF attachment: a thumbnail of page 1 plus name and page count. Used by the desktop chats and the mobile app.
// pdf.js (legacy build, for older mobile browsers) is loaded only when a PDF card first scrolls into view.
import { ReactNode, useEffect, useRef, useState } from 'react';
import { loadMedia, openMedia } from '@/lib/mediaCache';

type Thumb = { src: string; pages: number } | 'error';
const thumbs = new Map<string, Promise<Thumb>>();
let lib: Promise<typeof import('pdfjs-dist')> | null = null;

function pdfjs() {
  lib ??= (async () => {
    const m = await import('pdfjs-dist/legacy/build/pdf.mjs') as unknown as typeof import('pdfjs-dist');
    const worker = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
    m.GlobalWorkerOptions.workerSrc = worker;
    return m;
  })();
  return lib;
}

async function render(url: string): Promise<Thumb> {
  try {
    const local = await loadMedia(url);
    if (!local) return 'error';
    const m = await pdfjs();
    const doc = await m.getDocument({ url: local, isEvalSupported: false }).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2, 600 / base.width) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'error';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const out = { src: canvas.toDataURL('image/jpeg', 0.82), pages: doc.numPages };
    void doc.destroy();
    return out;
  } catch {
    return 'error';
  }
}

function thumbFor(url: string) {
  let p = thumbs.get(url);
  if (!p) { p = render(url); thumbs.set(url, p); }
  return p;
}

export const isPdfName = (name: string) => /\.pdf$/i.test(name.trim());

/** `fallback` is the plain file card, shown if the PDF cannot be previewed. */
export function PdfPreview({ url, name, fallback, compact }: { url: string; name: string; fallback: ReactNode; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'gone'>('idle');

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void thumbFor(url).then((t) => { if (alive) setThumb(t); });
    return () => { alive = false; };
  }, [visible, url]);

  if (thumb === 'error') return <>{fallback}</>;

  const open = async () => {
    if (state === 'busy') return;
    setState('busy');
    const ok = await openMedia(url, name);
    setState(ok ? 'idle' : 'gone');
  };
  const sub = state === 'busy' ? 'Abrindo…' : state === 'gone' ? 'Expirado no servidor' : thumb ? `PDF · ${thumb.pages} ${thumb.pages === 1 ? 'página' : 'páginas'}` : 'PDF';

  return (
    <div ref={ref} role="button" tabIndex={0} className={'pdfprev' + (compact ? ' pdfprev-compact' : '')} title={`Abrir ${name}`}
      onClick={(e) => { e.stopPropagation(); void open(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void open(); } }}>
      <div className="pdfprev-page">{thumb ? <img src={thumb.src} alt={`Primeira página de ${name}`} draggable={false} /> : <span className="pdfprev-ld" />}</div>
      <div className="pdfprev-meta">
        <span className="pdfprev-ic">PDF</span>
        <span className="pdfprev-tx"><b>{name}</b><small>{sub}</small></span>
      </div>
    </div>
  );
}
