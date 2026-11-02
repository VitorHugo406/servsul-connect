export interface RoomBooking {
  id: string; room_id: string; company_id: string; title: string;
  starts_at: string; ends_at: string; booked_by: string; notes?: string | null;
}

export function availabilityWindow(date: string, opens: string, closes: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Data inválida. Use YYYY-MM-DD.');
  const valid = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(valid.getTime()) || valid.toISOString().slice(0, 10) !== date) throw new Error('Data inválida.');
  // Room opening hours are stored in America/Sao_Paulo, as enforced by the booking trigger.
  return { start: new Date(`${date}T${opens}-03:00`).getTime(), end: new Date(`${date}T${closes}-03:00`).getTime() };
}

export function freeIntervals(bookings: RoomBooking[], start: number, end: number) {
  const busy = bookings.map(b => ({ start: Math.max(start, Date.parse(b.starts_at)), end: Math.min(end, Date.parse(b.ends_at)) }))
    .filter(b => b.start < b.end).sort((a, b) => a.start - b.start);
  let cursor = start;
  const free: { starts_at: string; ends_at: string; duration_minutes: number }[] = [];
  const add = (from: number, to: number) => free.push({ starts_at: new Date(from).toISOString(), ends_at: new Date(to).toISOString(), duration_minutes: (to - from) / 60000 });
  for (const interval of busy) {
    if (cursor < interval.start) add(cursor, interval.start);
    cursor = Math.max(cursor, interval.end);
  }
  if (cursor < end) add(cursor, end);
  return free;
}

export function isOccupied(booking: RoomBooking, now: number) {
  return Date.parse(booking.starts_at) <= now && now < Date.parse(booking.ends_at);
}