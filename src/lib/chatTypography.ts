export const CHAT_FONTS = ['system', 'arial', 'georgia', 'mono'] as const;
export type ChatFont = typeof CHAT_FONTS[number];
export interface ChatTypography { font: ChatFont; size: number; }
export const DEFAULT_CHAT_TYPOGRAPHY: ChatTypography = { font: 'system', size: 16 };
export function parseChatTypography(raw: string | null): ChatTypography {
  try {
    const value = JSON.parse(raw || '{}');
    return { font: CHAT_FONTS.includes(value?.font) ? value.font : 'system', size: Number.isInteger(value?.size) && value.size >= 12 && value.size <= 24 ? value.size : 16 };
  } catch { return { ...DEFAULT_CHAT_TYPOGRAPHY }; }
}
export const chatTypographyKey = (companyId: string, profileId: string) => `nuvexa:chat-typography:${companyId}:${profileId}`;