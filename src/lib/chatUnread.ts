export const chatUnreadStorageKey = (companyId: string, profileId: string) =>
  `nuvexa:chat-unread:${companyId}:${profileId}`;

export function parseUnreadMarks(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
  } catch { return []; }
}

export function updateUnreadMarks(marks: string[], key: string, unread: boolean): string[] {
  return unread ? Array.from(new Set([...marks, key])) : marks.filter(mark => mark !== key);
}