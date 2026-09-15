import { describe, expect, it } from 'vitest';

import {
  PLAN_MINUTES,
  googleCalendarUrl,
  icsFile,
  planEnd,
  roomLink,
  suggestedSlots,
  utcStamp,
} from '@/lib/plan';

const local = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

describe('suggestedSlots', () => {
  it('offers later today, same time tomorrow and tomorrow morning', () => {
    const slots = suggestedSlots(local(2026, 9, 15, 13, 40));
    expect(slots.map((s) => [s.day, s.start.getTime()])).toEqual([
      ['today', local(2026, 9, 15, 15).getTime()],
      ['tomorrow', local(2026, 9, 16, 13, 30).getTime()],
      ['tomorrow', local(2026, 9, 16, 9).getTime()],
    ]);
  });

  it('leaves at least 45 minutes before a start today', () => {
    expect(suggestedSlots(local(2026, 9, 15, 13, 10))[0].start).toEqual(local(2026, 9, 15, 14));
  });

  it('offers nothing today late in the evening', () => {
    const slots = suggestedSlots(local(2026, 9, 15, 22, 5));
    expect(slots.every((s) => s.day === 'tomorrow')).toBe(true);
    expect(slots[0].start).toEqual(local(2026, 9, 16, 20));
  });

  it('never repeats a start', () => {
    const slots = suggestedSlots(local(2026, 9, 15, 9, 0));
    const times = slots.map((s) => s.start.getTime());
    expect(new Set(times).size).toBe(times.length);
    expect(slots).toHaveLength(3);
  });
});

describe('calendar event', () => {
  const start = new Date(Date.UTC(2026, 8, 16, 7, 0));
  const link = 'https://coquiet.app/';

  it('lasts two hours', () => {
    expect(planEnd(start).getTime() - start.getTime()).toBe(PLAN_MINUTES * 60_000);
    expect(utcStamp(start)).toBe('20260916T070000Z');
  });

  it('builds a Google Calendar template link', () => {
    const url = new URL(googleCalendarUrl(start, link));
    expect(url.searchParams.get('dates')).toBe('20260916T070000Z/20260916T090000Z');
    expect(url.searchParams.get('details')).toContain(link);
  });

  it('writes a valid, folded .ics', () => {
    const ics = icsFile(start, link, start, 'abc');
    expect(ics).toContain('DTSTART:20260916T070000Z\r\n');
    expect(ics).toContain('DTEND:20260916T090000Z\r\n');
    expect(ics.split('\r\n').every((line) => line.length <= 75)).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});

it('drops query and fragment from the room link', () => {
  expect(roomLink({ origin: 'https://coquiet.app', pathname: '/' })).toBe('https://coquiet.app/');
});
