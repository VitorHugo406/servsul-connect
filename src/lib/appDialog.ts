// In-app replacements for window.confirm / window.prompt. They return promises and are rendered by
// <AppDialogHost /> (mounted once in App), so every question uses the system's own dialog.
export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};
export type PromptOptions = {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  maxLength?: number;
  inputType?: 'text' | 'url';
  /** Returns an error message to block confirming, or null when the value is fine. */
  validate?: (value: string) => string | null;
};
export type DialogRequest =
  | { id: number; kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { id: number; kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void };

let seq = 0;
const queue: DialogRequest[] = [];
const listeners = new Set<(q: DialogRequest[]) => void>();
const emit = () => listeners.forEach((l) => l([...queue]));

export function subscribeDialogs(l: (q: DialogRequest[]) => void) {
  listeners.add(l);
  l([...queue]);
  return () => { listeners.delete(l); };
}

export function settleDialog(id: number, value: boolean | string | null) {
  const i = queue.findIndex((r) => r.id === id);
  if (i < 0) return;
  const [r] = queue.splice(i, 1);
  emit();
  if (r.kind === 'confirm') r.resolve(value === true);
  else r.resolve(typeof value === 'string' ? value : null);
}

export function appConfirm(opts: ConfirmOptions | string): Promise<boolean> {
  const o = typeof opts === 'string' ? { title: opts } : opts;
  if (!listeners.size) return Promise.resolve(window.confirm(o.message ? `${o.title}\n\n${o.message}` : o.title));
  return new Promise((resolve) => { queue.push({ id: ++seq, kind: 'confirm', opts: o, resolve }); emit(); });
}

export function appPrompt(opts: PromptOptions | string): Promise<string | null> {
  const o = typeof opts === 'string' ? { title: opts } : opts;
  if (!listeners.size) return Promise.resolve(window.prompt(o.title, o.defaultValue ?? ''));
  return new Promise((resolve) => { queue.push({ id: ++seq, kind: 'prompt', opts: o, resolve }); emit(); });
}
