import { describe, expect, it } from 'vitest';
import { passwordError, passwordMissing } from './passwordPolicy';

describe('password policy', () => {
  it('accepts a password with letter, uppercase, number and special character', () => {
    expect(passwordError('Ab1!xy')).toBeNull();
    expect(passwordError('Ç@sa2026')).toBeNull();
  });
  it('rejects passwords missing a rule', () => {
    expect(passwordMissing('123456').map((r) => r.id)).toEqual(['letter', 'upper', 'special']);
    expect(passwordError('ab1!xy')).toMatch(/maiúscula/);
    expect(passwordError('Ab1!')).toMatch(/6 caracteres/);
    expect(passwordError('Abc!efg')).toMatch(/número/);
  });
  it('rejects spaces and overlong passwords', () => {
    expect(passwordError('Ab1! xyz')).toMatch(/espaços/);
    expect(passwordError('A1!' + 'a'.repeat(80))).toMatch(/no máximo/);
  });
});
