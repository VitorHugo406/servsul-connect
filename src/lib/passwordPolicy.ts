// Password rule for every new or changed password (2026-11-09): at least 6 characters (no upper
// limit beyond Supabase's 72) with a letter, an uppercase letter, a number and a special character.
// Login keeps accepting older passwords; the rule applies when a password is created or changed.
export const PASSWORD_MAX = 72;

export const PASSWORD_RULES: { id: string; label: string; test: (pw: string) => boolean }[] = [
  { id: 'len', label: 'Pelo menos 6 caracteres', test: (pw) => pw.length >= 6 },
  { id: 'letter', label: 'Pelo menos uma letra', test: (pw) => /\p{L}/u.test(pw) },
  { id: 'upper', label: 'Pelo menos uma letra maiúscula', test: (pw) => /\p{Lu}/u.test(pw) },
  { id: 'digit', label: 'Pelo menos um número', test: (pw) => /\d/.test(pw) },
  { id: 'special', label: 'Pelo menos um caractere especial (ex.: ! @ # $ %)', test: (pw) => /[^\p{L}\d\s]/u.test(pw) },
];

export const passwordMissing = (pw: string) => PASSWORD_RULES.filter((r) => !r.test(pw));

/** Error message for an invalid password, or null when it follows every rule. */
export function passwordError(pw: string): string | null {
  if (pw.length > PASSWORD_MAX) return `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`;
  if (/\s/.test(pw)) return 'A senha não pode ter espaços.';
  const miss = passwordMissing(pw);
  return miss.length ? 'A senha precisa ter: ' + miss.map((r) => r.label.replace(/^Pelo menos /, '').replace(/ \(ex\.:.*\)$/, '')).join(', ') + '.' : null;
}
