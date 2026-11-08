// Desktop chats: keep messages in server time order when realtime rows arrive (stable for
// equal times); optimistic "temp-" messages still being sent stay last.
export function orderByCreated<T extends { id: string; created_at: string }>(list: T[]): T[] {
  const t = (m: T) => new Date(m.created_at).getTime() || 0;
  const temp = (m: T) => m.id.startsWith('temp-');
  let ok = true;
  for (let i = 1; i < list.length && ok; i++) {
    const a = list[i - 1], b = list[i];
    if (temp(a) ? !temp(b) : !temp(b) && t(b) < t(a)) ok = false;
  }
  if (ok) return list;
  const done = list.map((m, i) => ({ m, i })).filter((x) => !temp(x.m)).sort((a, b) => t(a.m) - t(b.m) || a.i - b.i).map((x) => x.m);
  return [...done, ...list.filter(temp)];
}
