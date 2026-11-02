import { describe, it, expect } from 'vitest';
import { parseChatTypography, chatTypographyKey } from '@/lib/chatTypography';
import { matchesChatFilter } from '@/lib/chatFilters';

describe('chat preferences', () => {
  it('restores a selected font and size', () => { expect(parseChatTypography('{"font":"georgia","size":20}')).toEqual({ font: 'georgia', size: 20 }); expect(parseChatTypography('{"font":"invalid","size":500}')).toEqual({ font: 'system', size: 16 }); });
  it('isolates personal settings by company and profile', () => { expect(chatTypographyKey('a','person')).not.toBe(chatTypographyKey('b','person')); expect(chatTypographyKey('a','person')).not.toBe(chatTypographyKey('a','other')); });
  it('filters unread counts and manual reminders', () => { expect(matchesChatFilter('unread','direct','dm:a',1,[],[])).toBe(true); expect(matchesChatFilter('unread','groups','group:a',0,['group:a'],[])).toBe(true); expect(matchesChatFilter('unread','direct','dm:b',0,['dm:a'],[])).toBe(false); });
  it('shows only favorite conversations', () => { expect(matchesChatFilter('favorites','direct','dm:a',0,[],['dm:a'])).toBe(true); expect(matchesChatFilter('favorites','direct','dm:b',0,[],['dm:a'])).toBe(false); });
});