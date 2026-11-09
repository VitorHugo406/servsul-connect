// Renders appConfirm / appPrompt requests (src/lib/appDialog.ts) as the system's own dialog,
// on the PC (html.dark theme) and inside the mobile app (.ew[data-theme]). Built on Radix Dialog so it
// stacks correctly over other open dialogs (focus trap and outside-click handling are shared layers).
import { useEffect, useRef, useState } from 'react';
import * as RD from '@radix-ui/react-dialog';
import { settleDialog, subscribeDialogs, type DialogRequest } from '@/lib/appDialog';
import './appDialog.css';

const themeNow = () => {
  const ew = document.querySelector('.ew[data-theme]');
  if (ew) return ew.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

export function AppDialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  useEffect(() => subscribeDialogs(setQueue), []);
  const req = queue[0];
  if (!req) return null;
  return <DialogView key={req.id} req={req} />;
}

function DialogView({ req }: { req: DialogRequest }) {
  const isPrompt = req.kind === 'prompt';
  const o = req.opts as DialogRequest['opts'] & Record<string, any>;
  const [value, setValue] = useState<string>(isPrompt ? (o.defaultValue ?? '') : '');
  const [touched, setTouched] = useState(false);
  const [theme] = useState(themeNow);
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  const error = isPrompt ? (!value.trim() ? 'Preencha este campo.' : o.validate ? o.validate(value.trim()) : null) : null;
  const cancel = () => settleDialog(req.id, isPrompt ? null : false);
  const ok = () => {
    if (isPrompt) { setTouched(true); if (error) return; settleDialog(req.id, value.trim()); }
    else settleDialog(req.id, true);
  };

  return (
    <RD.Root open onOpenChange={(open) => { if (!open) cancel(); }}>
      <RD.Portal>
        <RD.Overlay className={'apd apd-' + theme}>
          <RD.Content className="apd-box" role={isPrompt ? 'dialog' : 'alertdialog'} aria-describedby={undefined}
            onOpenAutoFocus={(e) => { e.preventDefault(); (isPrompt ? inputRef.current : okRef.current)?.focus(); }}
            onPointerDownOutside={(e) => { e.preventDefault(); cancel(); }}>
            <RD.Title className="apd-title">{o.title}</RD.Title>
            {o.message ? <RD.Description className="apd-msg">{o.message}</RD.Description> : null}
            {isPrompt ? (
              <form onSubmit={(e) => { e.preventDefault(); ok(); }}>
                {o.label ? <label className="apd-label" htmlFor={`apd-i-${req.id}`}>{o.label}</label> : null}
                <input id={`apd-i-${req.id}`} ref={inputRef} className={'apd-input' + (touched && error ? ' bad' : '')} type={o.inputType === 'url' ? 'url' : 'text'}
                  value={value} maxLength={o.maxLength ?? 200} placeholder={o.placeholder} autoComplete="off"
                  onChange={(e) => setValue(e.target.value)} onBlur={() => value && setTouched(true)} />
                {touched && error ? <p className="apd-err">{error}</p> : null}
              </form>
            ) : null}
            <div className="apd-actions">
              <button type="button" className="apd-btn apd-sec" onClick={cancel}>{o.cancelText || 'Cancelar'}</button>
              <button type="button" ref={okRef} className={'apd-btn ' + (!isPrompt && o.danger ? 'apd-danger' : 'apd-pri')} onClick={ok}>{o.confirmText || (isPrompt ? 'Salvar' : 'Confirmar')}</button>
            </div>
          </RD.Content>
        </RD.Overlay>
      </RD.Portal>
    </RD.Root>
  );
}
