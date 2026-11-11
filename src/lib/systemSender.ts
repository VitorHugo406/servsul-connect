// "Comunicados": the single system sender used by automations (daily summaries, group welcome
// messages) and the monthly feedback DM. Nobody can write to it. See migration 20261109030000.
export const SYSTEM_SENDER_ID = '00000000-0000-0000-0000-0000000000c1';
export const SYSTEM_SENDER_NAME = 'Comunicados';
export const isSystemSender = (id: string | null | undefined) => id === SYSTEM_SENDER_ID;
/** Desktop components often only get the avatar URL; the system sender's photo is this file. */
export const isSystemAvatar = (url: string | null | undefined) => !!url && url.includes('/ewwon/img/comunicados.png');

/** "ewvon AI": answers to @ewvonai (company-owned Claude key). In direct chats its replies are rows sent by it with
 *  `ai_partner_id` = the other person of the conversation they belong to. See migration 20261112020000. */
export const AI_SENDER_ID = '00000000-0000-0000-0000-0000000000c2';
export const AI_SENDER_NAME = 'ewvon AI';
export const isAiSender = (id: string | null | undefined) => id === AI_SENDER_ID;
