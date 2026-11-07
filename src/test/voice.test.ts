import { describe, expect, it } from 'vitest';
import { fmtDuration, parseVoice } from '@/lib/e2e';
import { chatPreview } from '@/lib/stickers';

const PATH = '00000000-0000-0000-0000-0000000000a1/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.e2e';

describe('voice messages', () => {
  it('parses the encrypted voice reference', () => {
    expect(parseVoice(`🎤 [0:12](voice:${PATH})`)).toEqual({ duration: '0:12', path: PATH });
    expect(parseVoice('🎤 [0:12](voice:../../etc/passwd)')).toBeNull();
    expect(parseVoice('olá')).toBeNull();
  });
  it('formats duration and preview', () => {
    expect(fmtDuration(72.4)).toBe('1:12');
    expect(chatPreview(`🎤 [0:12](voice:${PATH})`)).toBe('🎤 Áudio (0:12)');
  });
});
