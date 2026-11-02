import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { availabilityWindow, freeIntervals, isOccupied, type RoomBooking } from './roomAvailability.ts';

const booking = (start: string, end: string): RoomBooking => ({ id: 'booking', room_id: 'room', company_id: 'company', title: 'Reunião', booked_by: 'person', starts_at: `2026-11-02T${start}-03:00`, ends_at: `2026-11-02T${end}-03:00` });
Deno.test('free times exclude meetings and merge overlaps', () => {
  const { start, end } = availabilityWindow('2026-11-02', '08:00:00', '18:00:00');
  const free = freeIntervals([booking('09:00:00', '10:00:00'), booking('09:30:00', '11:00:00')], start, end);
  assertEquals(free.map(slot => slot.duration_minutes), [60, 420]);
});
Deno.test('occupancy includes start and excludes end', () => {
  const meeting = booking('09:00:00', '10:00:00');
  assertEquals(isOccupied(meeting, Date.parse(meeting.starts_at)), true);
  assertEquals(isOccupied(meeting, Date.parse(meeting.ends_at)), false);
});
Deno.test('invalid calendar dates are rejected', () => {
  assertThrows(() => availabilityWindow('2026-02-30', '08:00:00', '18:00:00'));
});