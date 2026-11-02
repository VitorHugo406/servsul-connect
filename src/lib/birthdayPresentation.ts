export function canManageBirthdayPresentation(roles: { role: string }[]) {
  return roles.some(({ role }) => ['admin', 'super_admin', 'supervisor', 'diretoria', 'gerente', 'gestor'].includes(role));
}

export function upcomingBirthdayPeople<T extends { isToday: boolean; birthDay: number }>(people: T[], currentDay: number): T[] {
  return people.filter(person => person.isToday || person.birthDay > currentDay).sort((a, b) => a.birthDay - b.birthDay);
}