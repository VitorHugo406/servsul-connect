import { describe, expect, it } from 'vitest';
import { chatPreview, parseSticker, stickerContent } from '@/lib/stickers';

const CO = '00000000-0000-0000-0000-0000000000a1';
const SHA = 'a'.repeat(64);

describe('stickers', () => {
  it('round-trips image and emoji stickers', () => {
    expect(parseSticker(stickerContent({ kind: 'img', companyId: CO, sha: SHA }))).toEqual({ kind: 'img', companyId: CO, sha: SHA });
    expect(parseSticker(stickerContent({ kind: 'emoji', emoji: '🥳' }))).toEqual({ kind: 'emoji', emoji: '🥳' });
  });
  it('does not treat normal text as a sticker', () => {
    expect(parseSticker('oi ✨ sticker:e:🥳')).toBeNull();
    expect(parseSticker(`✨ sticker:${CO}/notahash`)).toBeNull();
  });
});

describe('chatPreview', () => {
  it('formats stickers, photos, files and task cards', () => {
    expect(chatPreview(`✨ sticker:${CO}/${SHA}`)).toBe('✨ Figurinha');
    expect(chatPreview('📷 [a.png](https://x/a.png)')).toBe('📷 Foto');
    expect(chatPreview('📷 [a.png](https://x/a)\n📷 [b.png](https://x/b)')).toBe('📷 2 fotos');
    expect(chatPreview('📎 [relatorio.pdf](https://x/r)')).toBe('📎 relatorio.pdf');
    expect(chatPreview('📋 Card #10 — Teste\n⚡ Prioridade: Média')).toBe('📋 Teste');
  });
  it('truncates long text', () => {
    expect(chatPreview('x'.repeat(100), 20)).toHaveLength(20);
  });
});

import { packContent, parsePack } from '@/lib/stickers';
describe('sticker packs', () => {
  it('round-trips the shared pack reference', () => {
    const id = '33333333-3333-3333-3333-333333333333';
    expect(parsePack(packContent(id))).toBe(id);
    expect(parsePack('✨ pack:../x')).toBeNull();
    expect(chatPreview(packContent(id))).toBe('✨ Pacote de figurinhas');
  });
});
