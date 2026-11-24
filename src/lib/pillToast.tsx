// Avisos do sistema ("Conta criada", "Chamada recusada", erros…) no mesmo formato da bolinha de abertura das abas:
// aparece como um ponto no centro, embaixo da tela, abre mostrando a mensagem, brilha, fecha e some.
// Substitui o sonner (alias em vite.config) e o toast do shadcn: todas as chamadas toast.success/error/info/message continuam iguais.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, Info } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
type Item = { id: number; kind: Kind; text: string };
type Opts = { description?: unknown; duration?: number; id?: string | number } | undefined;

let seq = 0;
let current: Item | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
/** Texto amigável: nunca mostra ids do banco, mensagens técnicas do Supabase/Postgres nem códigos internos. */
export function friendlyText(raw: unknown, kind: Kind = 'info'): string {
  let s = typeof raw === 'string' ? raw : raw == null ? '' : typeof raw === 'object' && 'message' in (raw as any) ? String((raw as any).message) : String(raw);
  s = s.replace(/\s+/g, ' ').trim();
  if (!s || s === 'undefined' || s === 'null' || s === '[object Object]') return kind === 'error' ? 'Não foi possível concluir agora. Tente novamente.' : '';
  if (/row-level security|permission denied|not authorized|forbidden/i.test(s)) return 'Você não tem permissão para fazer isso.';
  if (/duplicate key|already exists|unique constraint/i.test(s)) return 'Este registro já existe.';
  if (/foreign key|violates/i.test(s)) return 'Este item está vinculado a outros dados e não pode ser alterado assim.';
  if (/jwt|invalid token|refresh token|session (expired|not found)/i.test(s)) return 'Sua sessão expirou. Entre novamente.';
  if (/failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(s)) return 'Sem conexão com o servidor. Verifique sua internet.';
  if (/PGRST|FunctionsHttpError|FunctionsFetchError|FunctionsRelayError|non-2xx|SyntaxError|TypeError|ReferenceError|Unexpected token|does not exist|syntax error|invalid input syntax|null value in column|stack|at .*\(.*:\d+:\d+\)/i.test(s)) return 'Não foi possível concluir agora. Tente novamente.';
  s = s.replace(/^\s*[A-Z][A-Z0-9_]{3,}:\s*/, '').replace(UUID, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
  if (s.length > 160) s = s.slice(0, 157).trimEnd() + '…';
  return s;
}

function show(kind: Kind, message: unknown, opts?: Opts) {
  let text = friendlyText(message, kind);
  const d = opts?.description !== undefined ? friendlyText(opts.description, kind) : '';
  if (d) text = text ? `${text} · ${d}` : d;
  if (!text) return seq;
  if (current && current.text === text && current.kind === kind) return current.id;   // mesma mensagem repetida: não reinicia
  current = { id: ++seq, kind, text };
  emit();
  return current.id;
}
function dismiss() { current = null; emit(); }

type Fn = (message: unknown, opts?: Opts) => number;
const base: Fn = (m, o) => show('info', m, o);
export const toast = Object.assign(base, {
  success: ((m, o) => show('success', m, o)) as Fn,
  error: ((m, o) => show('error', m, o)) as Fn,
  info: ((m, o) => show('info', m, o)) as Fn,
  message: ((m, o) => show('info', m, o)) as Fn,
  warning: ((m, o) => show('error', m, o)) as Fn,
  loading: ((m, o) => show('info', m, o)) as Fn,
  custom: (() => seq) as Fn,
  dismiss: (_id?: unknown) => dismiss(),
  promise: <T,>(p: Promise<T> | (() => Promise<T>), o?: { loading?: unknown; success?: unknown | ((v: T) => unknown); error?: unknown | ((e: unknown) => unknown) }) => {
    const pr = typeof p === 'function' ? p() : p;
    if (o?.loading) show('info', o.loading);
    pr.then((v) => { if (o?.success) show('success', typeof o.success === 'function' ? (o.success as (v: T) => unknown)(v) : o.success); }, (e) => { show('error', o?.error ? (typeof o.error === 'function' ? (o.error as (e: unknown) => unknown)(e) : o.error) : e); });
    return pr;
  },
});

type Phase = 'dot' | 'expanded' | 'glow' | 'collapse';
const ICON = { success: Check, error: AlertCircle, info: Info } as const;

function Pill({ item, onDone }: { item: Item; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('dot');
  const Icon = ICON[item.kind];
  const isExpanded = phase === 'expanded' || phase === 'glow';
  const width = Math.min(460, Math.max(154, item.text.length * 7.4 + 80));
  useEffect(() => {
    const hold = Math.min(6000, Math.max(2000, 1400 + item.text.length * 45));
    const t = [
      window.setTimeout(() => setPhase('expanded'), 320),
      window.setTimeout(() => setPhase('glow'), 320 + hold * 0.55),
      window.setTimeout(() => setPhase('collapse'), 320 + hold),
      window.setTimeout(onDone, 320 + hold + 480),
    ];
    return () => t.forEach(clearTimeout);
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, scale: 0.55, filter: 'blur(5px)', width: 44 }}
      animate={{
        opacity: phase === 'collapse' ? 0.92 : 1, scale: phase === 'collapse' ? 0.96 : 1, filter: 'blur(0px)', width: isExpanded ? width : 44,
        boxShadow: phase === 'glow'
          ? '0 0 0 1px rgba(255,255,255,0.95), 0 0 0 5px rgba(148,163,184,0.18), 0 0 22px rgba(255,255,255,0.75), 0 18px 48px rgba(15,23,42,0.30)'
          : '0 8px 24px rgba(15,23,42,0.12)',
      }}
      exit={{ opacity: 0, scale: 0.62, filter: 'blur(7px)', transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } }}
      transition={{ opacity: { duration: phase === 'collapse' ? 0.28 : 0.24 }, scale: { type: 'spring', stiffness: 360, damping: 27 }, filter: { duration: 0.24 }, width: { type: 'spring', stiffness: 300, damping: 28 }, boxShadow: { duration: 0.42, ease: 'easeOut' } }}
      className="flex h-11 items-center overflow-hidden rounded-full border border-white/70 bg-white/90 px-1.5 text-slate-900 backdrop-blur-2xl"
      role="status" aria-label={item.text}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${item.kind === 'error' ? 'bg-red-600' : item.kind === 'success' ? 'bg-emerald-600' : 'bg-slate-950'}`}><Icon className="h-4 w-4" strokeWidth={2} /></span>
      <motion.span initial={false} animate={{ opacity: isExpanded ? 1 : 0, x: isExpanded ? 0 : -5 }} transition={{ duration: 0.2, delay: isExpanded ? 0.08 : 0 }} className="min-w-0 flex-1 truncate px-3 text-[13px] font-semibold tracking-[-0.02em]">{item.text}</motion.span>
      <motion.span animate={{ opacity: isExpanded ? 0.7 : 0, scale: isExpanded ? 1 : 0.7 }} transition={{ duration: 0.18 }} className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
    </motion.div>
  );
}


export function Toaster() {
  const item = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => current, () => null);
  const ref = useRef(item); ref.current = item;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[10050] flex justify-center" style={{ bottom: 'calc(var(--ew-sabottom,env(safe-area-inset-bottom,0px)) + var(--pill-bottom, 24px))' }} aria-live="polite">
      <style>{'@media (max-width:767px){:root{--pill-bottom:92px}}'}</style>
      <AnimatePresence mode="wait">{item && <Pill key={item.id} item={item} onDone={() => { if (ref.current === item) dismiss(); }} />}</AnimatePresence>
    </div>
  );
}
