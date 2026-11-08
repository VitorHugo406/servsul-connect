// "Comunicados": the single system sender used by automations (daily summaries, group welcome
// messages) and the monthly feedback DM. Nobody can write to it. See migration 20261109030000.
export const SYSTEM_SENDER_ID = '00000000-0000-0000-0000-0000000000c1';
export const SYSTEM_SENDER_NAME = 'Comunicados';
export const isSystemSender = (id: string | null | undefined) => id === SYSTEM_SENDER_ID;
/** Desktop components often only get the avatar URL; the system sender's photo is this file. */
export const isSystemAvatar = (url: string | null | undefined) => !!url && url.includes('/ewwon/img/comunicados.png');
