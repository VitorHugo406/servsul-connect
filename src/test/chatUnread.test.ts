import { describe, expect, it } from 'vitest';
import { chatUnreadStorageKey, parseUnreadMarks, updateUnreadMarks } from '../lib/chatUnread';

describe('manual conversation unread marks', () => {
  it('marks a conversation unread and retains it after saving', () => {
    const saved = JSON.stringify(updateUnreadMarks([], 'dm:person', true));
    expect(parseUnreadMarks(saved)).toEqual(['dm:person']);
  });
  it('opening a conversation clears only its own mark', () => {
    expect(updateUnreadMarks(['dm:person', 'group:team'], 'dm:person', false)).toEqual(['group:team']);
  });
  it('isolates markers by company and person', () => {
    expect(chatUnreadStorageKey('company-a', 'person-a')).not.toBe(chatUnreadStorageKey('company-b', 'person-a'));
    expect(chatUnreadStorageKey('company-a', 'person-a')).not.toBe(chatUnreadStorageKey('company-a', 'person-b'));
  });
});