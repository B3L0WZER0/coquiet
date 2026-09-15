import { describe, expect, it } from 'vitest';

import { pulse } from '@/lib/presence/aggregate';
import {
  BASELINE_COUNT,
  BASELINE_SHARED,
  RESHUFFLE_MS,
  rankedSplit,
  withBaseline,
} from '@/lib/presence/baseline';
import type { PresenceSession } from '@/lib/presence/types';

// The start of an hour, so "within the hour" doesn't straddle a reshuffle.
const HOUR = Math.floor(1_700_000_000_000 / RESHUFFLE_MS) * RESHUFFLE_MS;
const HOURS = Array.from({ length: 500 }, (_, i) => HOUR + i * RESHUFFLE_MS);

const real: PresenceSession = {
  id: 'real',
  activity: 'studying',
  drink: 'water',
  channel: 'still',
  lastSeen: 0,
};

function strictlyDecreasing(counts: number[]): boolean {
  return counts.every((c, i) => i === 0 || c < counts[i - 1]);
}

describe('standing room', () => {
  it('is 72 people, with real sessions counted on top', () => {
    expect(BASELINE_COUNT).toBe(72);
    expect(withBaseline([], HOUR)).toHaveLength(72);
    expect(withBaseline([real], HOUR)).toHaveLength(73);
    expect(withBaseline([real], HOUR).at(-1)).toBe(real);
  });

  it('always has 50 people with an activity and a drink', () => {
    for (const now of HOURS) {
      const room = withBaseline([], now);
      expect(room.filter((s) => s.activity !== null)).toHaveLength(BASELINE_SHARED);
      expect(room.filter((s) => s.drink !== null)).toHaveLength(BASELINE_SHARED);
    }
  });

  it('ranks working > studying > reading > creating, and coffee > tea > water', () => {
    for (const now of HOURS) {
      const p = pulse(withBaseline([], now));
      expect(p.activities.map((a) => a.key)).toEqual(['working', 'studying', 'reading', 'creating']);
      expect(strictlyDecreasing(p.activities.map((a) => a.count))).toBe(true);
      expect(p.drinks.map((d) => d.key)).toEqual(['coffee', 'tea', 'water']);
      expect(strictlyDecreasing(p.drinks.map((d) => d.count))).toBe(true);
    }
  });

  it('is the same for everyone within the hour, and varies between hours', () => {
    const counts = (now: number) => pulse(withBaseline([], now)).activities.map((a) => a.count);
    expect(counts(HOUR + 1000)).toEqual(counts(HOUR + RESHUFFLE_MS - 1000));
    expect(new Set(HOURS.map((h) => counts(h).join())).size).toBeGreaterThan(10);
  });

  it('splits into strictly decreasing counts that add up', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1000; i++) {
      const split = rankedSplit(50, 4, rand);
      expect(split.reduce((a, b) => a + b, 0)).toBe(50);
      expect(strictlyDecreasing(split)).toBe(true);
      expect(split.at(-1)).toBeGreaterThanOrEqual(1);
    }
  });

  it('gives every simulated session a distinct id', () => {
    const ids = withBaseline([], HOUR).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
