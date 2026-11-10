// Sistema <-> Dash: one switch, one soft transition (logo drawn + name) that covers the change of screen.
export type AppMode = 'system' | 'dash';
const EVENT = 'ewvon:mode-switch';
export type ModeSwitchDetail = { to: AppMode; go: () => void };
export const switchMode = (to: AppMode, go: () => void) => window.dispatchEvent(new CustomEvent<ModeSwitchDetail>(EVENT, { detail: { to, go } }));
export const MODE_EVENT = EVENT;
