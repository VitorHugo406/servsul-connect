import { describe, expect, it } from 'vitest';
import { orderMsgs, type Msg } from '@/components/ewwon/data';

const m = (id: string, at: string, pending = false): Msg => ({ id, t: id, at, h: '', me: false, from: null, r: [], mine: [], pending });

describe('orderMsgs', () => {
  it('keeps an already ordered list as the same array', () => {
    const l = [m('a', '2026-11-09T10:00:00Z'), m('b', '2026-11-09T10:01:00Z'), m('p', '2026-11-09T09:00:00Z', true)];
    expect(orderMsgs(l)).toBe(l);
  });
  it('sorts by server time and keeps pending messages last', () => {
    const l = [m('old-local', '2026-11-09T09:00:00Z'), m('p1', '2026-11-09T08:00:00Z', true), m('new', '2026-11-09T10:00:00Z'), m('mid', '2026-11-09T09:30:00Z'), m('p2', '2026-11-09T07:00:00Z', true)];
    expect(orderMsgs(l).map((x) => x.id)).toEqual(['old-local', 'mid', 'new', 'p1', 'p2']);
  });
  it('is stable for equal times', () => {
    const at = '2026-11-09T10:00:00Z';
    const l = [m('b', '2026-11-09T11:00:00Z'), m('x', at), m('y', at)];
    expect(orderMsgs(l).map((x) => x.id)).toEqual(['x', 'y', 'b']);
  });
  it('moves a loaded-earlier message that was appended at the end', () => {
    const l = [m('n1', '2026-11-09T10:00:00Z'), m('n2', '2026-11-09T10:05:00Z'), m('older', '2026-11-08T10:00:00Z')];
    expect(orderMsgs(l).map((x) => x.id)).toEqual(['older', 'n1', 'n2']);
  });
});
