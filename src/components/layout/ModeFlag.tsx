// The Sistema | Dash flag (one switch, shown in both "systems"). In Dash the same flag lives inside the Dash screen.
import { switchMode, type AppMode } from '@/lib/modeSwitch';

export function ModeFlag({ mode = 'system', onSwitch }: { mode?: AppMode; onSwitch: (to: AppMode) => void }) {
  const go = (to: AppMode) => { if (to !== mode) switchMode(to, () => onSwitch(to)); };
  return (
    <div className="ewvon-modeflag" data-m={mode} role="group" aria-label="Alternar entre Sistema e Dash" title="Dash · exclusivo do plano Empresarial">
      <span className="ewvon-modeflag-th" />
      <button type="button" aria-pressed={mode === 'system'} onClick={() => go('system')}>Sistema</button>
      <button type="button" aria-pressed={mode === 'dash'} onClick={() => go('dash')}>Dash</button>
    </div>
  );
}
