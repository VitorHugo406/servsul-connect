import { Children, isValidElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Lista suspensa estilizada, substituta direta de <select> (mesmas props: value, onChange(e.target.value), disabled,
 * <option> como filhos). A caixa de opções é desenhada pelo sistema (não pelo navegador) e abre em um portal.
 */
interface SelProps {
  value?: string | number;
  onChange?: (e: { target: { value: string }; currentTarget: { value: string } }) => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  id?: string;
  children?: ReactNode;
  'aria-label'?: string;
  title?: string;
}

interface Opt { value: string; label: ReactNode; disabled?: boolean }

function collect(children: ReactNode, out: Opt[]) {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const el = c as any;
    if (el.type === 'option') {
      const label = el.props.children;
      const value = el.props.value !== undefined ? String(el.props.value) : (Array.isArray(label) ? label.join('') : String(label ?? ''));
      out.push({ value, label, disabled: el.props.disabled });
    } else if (el.props?.children) collect(el.props.children, out);
  });
}

export function Sel({ value, onChange, disabled, className, style, id, children, title, ...rest }: SelProps) {
  const opts = useMemo(() => { const o: Opt[] = []; collect(children, o); return o; }, [children]);
  const cur = opts.find(o => o.value === String(value ?? ''));
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; max: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 180 && above > below;
    setPos({ left: r.left, width: Math.max(r.width, 160), max: Math.min(280, Math.max(120, up ? above : below)), ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (e.type === 'scroll' && list.current?.contains(e.target as Node)) return; setOpen(false); };
    const down = (e: MouseEvent) => { if (!btn.current?.contains(e.target as Node) && !list.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', down);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [open]);
  useEffect(() => { if (open) list.current?.querySelector('[data-hi="1"]')?.scrollIntoView({ block: 'nearest' }); }, [hi, open]);

  const pick = (o: Opt) => {
    if (o.disabled) return;
    setOpen(false);
    btn.current?.focus();
    if (o.value !== String(value ?? '')) onChange?.({ target: { value: o.value }, currentTarget: { value: o.value } });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault(); setHi(Math.max(0, opts.findIndex(o => o.value === String(value ?? '')))); setOpen(true); return;
    }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(opts.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (opts[hi]) pick(opts[hi]); }
  };

  return (
    <>
      <button ref={btn} type="button" id={id} title={title} aria-label={rest['aria-label']} aria-haspopup="listbox" aria-expanded={open}
        disabled={disabled} className={`sel-btn ${className || ''}`} style={style}
        onClick={() => { setHi(Math.max(0, opts.findIndex(o => o.value === String(value ?? '')))); setOpen(o => !o); }} onKeyDown={onKey}>
        <span className="sel-val">{cur ? cur.label : (opts[0]?.label ?? '')}</span>
        <svg className="sel-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && pos && createPortal(
        <div ref={list} className="sel-list" role="listbox" style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.width, maxHeight: pos.max }}>
          {opts.map((o, i) => (
            <div key={o.value + i} role="option" aria-selected={o.value === String(value ?? '')} data-hi={i === hi ? '1' : undefined}
              className={`sel-opt${o.value === String(value ?? '') ? ' on' : ''}${i === hi ? ' hi' : ''}${o.disabled ? ' off' : ''}`}
              onMouseEnter={() => setHi(i)} onMouseDown={e => e.preventDefault()} onClick={() => pick(o)}>
              <span>{o.label}</span>
              {o.value === String(value ?? '') && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>}
            </div>
          ))}
        </div>, document.body)}
    </>
  );
}
