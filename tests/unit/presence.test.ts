import { describe, expect, it } from 'vitest';

import {
  EXPIRY_MS,
  HEARTBEAT_MS,
  MIN_GROUP_FOR_BREAKDOWN,
  live,
  presenceSummary,
  pulse,
} from '@/lib/presence/aggregate';
import { entryPresenceLine, roomPresenceLine } from '@/lib/presence/copy';
import type { Activity, Drink, PresenceSession } from '@/lib/presence/types';

const NOW = 1_700_000_000_000;

function session(
  id: string,
  { activity = null, drink = null, age = 0 }: { activity?: Activity | null; drink?: Drink | null; age?: number } = {},
): PresenceSession {
  return { id, activity, drink, channel: 'flow', lastSeen: NOW - age };
}

describe('expiry', () => {
  it('allows several missed heartbeats before giving up on a session', () => {
    // A briefly throttled background tab must not be mistaken for someone who
    // left, so the window has to be comfortably wider than one beat.
    expect(EXPIRY_MS).toBeGreaterThan(HEARTBEAT_MS * 4);
    // ...but still inside the window the spec asks for.
    expect(EXPIRY_MS).toBeGreaterThanOrEqual(60_000);
    expect(EXPIRY_MS).toBeLessThanOrEqual(90_000);
  });

  it('keeps sessions heard from inside the window', () => {
    const sessions = [session('a'), session('b', { age: EXPIRY_MS - 1000 })];
    expect(live(sessions, NOW).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('drops sessions that have gone quiet', () => {
    const sessions = [
      session('here', { age: 1000 }),
      session('gone', { age: EXPIRY_MS + 1 }),
      session('long gone', { age: 10 * EXPIRY_MS }),
    ];
    expect(live(sessions, NOW).map((s) => s.id)).toEqual(['here']);
  });

  it('drops a session exactly on the boundary', () => {
    expect(live([session('edge', { age: EXPIRY_MS })], NOW)).toHaveLength(0);
  });

  it('empties out entirely once everyone has stopped', () => {
    const sessions = [session('a', { age: 1000 }), session('b', { age: 2000 })];
    // No new heartbeats, clock moves well past the window.
    expect(live(sessions, NOW + EXPIRY_MS + 5000)).toEqual([]);
  });
});

describe('room pulse', () => {
  it('counts activities and drinks without recording who chose what', () => {
    // Distinctive ids, so "the id does not appear" is a real assertion rather
    // than one that a single letter could satisfy by accident.
    const sessions = [
      session('sess-zulu', { activity: 'working', drink: 'coffee' }),
      session('sess-yankee', { activity: 'working', drink: 'tea' }),
      session('sess-xray', { activity: 'reading', drink: 'coffee' }),
    ];
    const p = pulse(sessions);
    expect(p.count).toBe(3);
    expect(p.showBreakdown).toBe(true);
    expect(p.activities).toEqual([
      { key: 'working', count: 2 },
      { key: 'reading', count: 1 },
    ]);
    expect(p.drinks).toEqual([
      { key: 'coffee', count: 2 },
      { key: 'tea', count: 1 },
    ]);
    // Nothing in the output can be traced back to a particular session.
    const serialised = JSON.stringify(p);
    for (const s of sessions) expect(serialised).not.toContain(s.id);
  });

  it('withholds the breakdown while the room is small enough to identify people', () => {
    for (let n = 0; n < MIN_GROUP_FOR_BREAKDOWN; n++) {
      const sessions = Array.from({ length: n }, (_, i) =>
        session(`s${i}`, { activity: 'studying', drink: 'tea' }),
      );
      expect(pulse(sessions).showBreakdown).toBe(false);
    }
    const enough = Array.from({ length: MIN_GROUP_FOR_BREAKDOWN }, (_, i) => session(`s${i}`));
    expect(pulse(enough).showBreakdown).toBe(true);
  });

  it('counts people who shared nothing in the total and nowhere else', () => {
    const sessions = [session('a'), session('b'), session('c', { activity: 'creating' })];
    const p = pulse(sessions);
    expect(p.count).toBe(3);
    expect(p.activities).toEqual([{ key: 'creating', count: 1 }]);
    expect(p.drinks).toEqual([]);
  });

  it('does not list "nothing" as a drink', () => {
    const sessions = [
      session('a', { drink: 'nothing' }),
      session('b', { drink: 'nothing' }),
      session('c', { drink: 'water' }),
    ];
    expect(pulse(sessions).drinks).toEqual([{ key: 'water', count: 1 }]);
  });
});

describe('personal summary', () => {
  it('joins what was chosen', () => {
    expect(presenceSummary('working', 'coffee')).toBe('Working · Coffee');
    expect(presenceSummary('reading', null)).toBe('Reading');
    expect(presenceSummary('creating', 'nothing')).toBe('Creating · Nothing');
  });

  it('is null when nothing was chosen', () => {
    expect(presenceSummary(null, null)).toBeNull();
  });
});

describe('honest copy', () => {
  it('says nothing at all when no adapter is running', () => {
    // Not a stand-in line. Filler in place of a fact is still a claim — and
    // the live dot beside it would be claiming to be listening.
    expect(entryPresenceLine({ kind: 'unavailable' })).toBeNull();
    expect(roomPresenceLine({ kind: 'unavailable' })).toBeNull();
  });

  it('states the room is open without claiming anyone is in it', () => {
    const empty = entryPresenceLine({ kind: 'live', count: 0 });
    expect(empty).toBe('Room open');
    expect(empty).not.toMatch(/\d/);
  });

  it('counts the people already working, on the way in', () => {
    expect(entryPresenceLine({ kind: 'live', count: 1 })).toBe('Room open · 1 focusing now');
    expect(entryPresenceLine({ kind: 'live', count: 24 })).toBe('Room open · 24 focusing now');
  });

  it('invites rather than promising company, when there is none', () => {
    // Inside the room this visitor is always one of the sessions counted, so a
    // count of one means "only you" — reporting "1 here now" would imply
    // somebody else.
    expect(roomPresenceLine({ kind: 'live', count: 1 })).toBe('The room is yours for now');
  });

  it('places the visitor among the others rather than reporting a total', () => {
    // The count includes this visitor, so what is stated is everyone else.
    expect(roomPresenceLine({ kind: 'live', count: 2 })).toBe('Focusing with 1 other');
    expect(roomPresenceLine({ kind: 'live', count: 3 })).toBe('Focusing with 2 others');
    expect(roomPresenceLine({ kind: 'live', count: 313 })).toBe('Focusing with 312 others');
  });

  it('never promises that other people will arrive', () => {
    // The room has no way to know that, so it must not say it.
    for (const status of [
      { kind: 'unavailable' } as const,
      { kind: 'live', count: 0 } as const,
      { kind: 'live', count: 1 } as const,
      { kind: 'live', count: 5 } as const,
    ]) {
      expect(entryPresenceLine(status) ?? '').not.toMatch(/will join|others will/i);
      expect(roomPresenceLine(status) ?? '').not.toMatch(/will join|others will/i);
    }
  });

  it('states a number only when one was actually supplied', () => {
    // The empty and unavailable cases are the ones where a plausible-looking
    // figure would be most tempting and least honest.
    expect(roomPresenceLine({ kind: 'unavailable' }) ?? '').not.toMatch(/\d/);
    expect(roomPresenceLine({ kind: 'live', count: 0 }) ?? '').not.toMatch(/\d/);
    expect(roomPresenceLine({ kind: 'live', count: 1 }) ?? '').not.toMatch(/\d/);
    expect(entryPresenceLine({ kind: 'live', count: 0 }) ?? '').not.toMatch(/\d/);
  });

  it('reports only counts it was actually given', () => {
    expect(entryPresenceLine({ kind: 'live', count: 4 })).toBe('Room open · 4 focusing now');
    expect(roomPresenceLine({ kind: 'live', count: 2 })).toBe('Focusing with 1 other');
    expect(roomPresenceLine({ kind: 'live', count: 12 })).toBe('Focusing with 11 others');
  });
});
