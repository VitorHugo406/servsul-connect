import { describe, expect, it } from 'vitest';
import { canManageBirthdayPresentation, upcomingBirthdayPeople } from '../lib/birthdayPresentation';

describe('birthday presentation for ordinary users', () => {
  it('does not expose report controls to ordinary users', () => {
    expect(canManageBirthdayPresentation([{ role: 'colaborador' }])).toBe(false);
    expect(canManageBirthdayPresentation([])).toBe(false);
  });
  it('keeps management controls available for management roles', () => {
    for (const role of ['admin', 'super_admin', 'supervisor', 'diretoria']) expect(canManageBirthdayPresentation([{ role }])).toBe(true);
  });
  it('shows today and upcoming birthdays, not birthdays already passed', () => {
    expect(upcomingBirthdayPeople([{ isToday: false, birthDay: 3 }, { isToday: false, birthDay: 20 }, { isToday: true, birthDay: 10 }], 10).map(p => p.birthDay)).toEqual([10, 20]);
  });
});