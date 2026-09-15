import { describe, expect, it } from 'vitest';

import { pulse } from '@/lib/presence/aggregate';
import {
  BASELINE_MAX,
  BASELINE_MIN,
  BASELINE_SHARED_RATIO,
  RESHUFFLE_MS,
  baselineCount,
  rankedSplit,
  withBaseline,
} from '@/lib/presence/baseline';
import type { PresenceSession } from '@/lib/presence/types';

// The start of an hour, so "within the hour" doesn't straddle a reshuffle.
const HOUR = Math.floor(1_700_000_000_000 / RESHUFFLE_MS) * RESHUFFLE_MS;
const MINUTE = 60_000;
const HOURS = Array.from({ length: 500 }, (_, i) => HOUR + i * RESHUFFLE_MS);
const DAY_BY_MINUTE = Array.from({ length: 24 * 60 }, (_, i) => HOUR + i * MINUTE);

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

describe('standing room size', () => {
  it('stays between 60 and 80', () => {
    for (const now of DAY_BY_MINUTE) {
      const n = baselineCount(now);
      expect(n).toBeGreaterThanOrEqual(BASELINE_MIN);
      expect(n).toBeLessThanOrEqual(BASELINE_MAX);
    }
  });

  it('actually moves, but only a little from one minute to the next', () => {
    const counts = DAY_BY_MINUTE.map(baselineCount);
    expect(new Set(counts).size).toBeGreaterThan(10);
    for (let i = 1; i < counts.length; i++) {
      expect(Math.abs(counts[i] - counts[i - 1])).toBeLessThanOrEqual(4);
    }
  });

  it('is the same for every visitor at the same moment', () => {
    expect(baselineCount(HOUR + 12_345)).toBe(baselineCount(HOUR + 12_345));
  });

  it('counts real sessions on top', () => {
    const n = baselineCount(HOUR);
    expect(withBaseline([], HOUR)).toHaveLength(n);
    expect(withBaseline([real], HOUR)).toHaveLength(n + 1);
    expect(withBaseline([real], HOUR).at(-1)).toBe(real);
  });
});

describe('standing room pulse', () => {
  it('gives about 70% of the room an activity and a drink', () => {
    for (const now of HOURS) {
      const room = withBaseline([], now);
      const shared = Math.round(room.length * BASELINE_SHARED_RATIO);
      expect(room.filter((s) => s.activity !== null)).toHaveLength(shared);
      expect(room.filter((s) => s.drink !== null)).toHaveLength(shared);
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

  it('reshuffles between hours', () => {
    const shares = (now: number) => {
      const p = pulse(withBaseline([], now));
      return p.activities.map((a) => (a.count / p.count).toFixed(1)).join();
    };
    expect(new Set(HOURS.map(shares)).size).toBeGreaterThan(5);
  });

  it('splits into strictly decreasing counts that add up', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1000; i++) {
      const split = rankedSplit(42, 4, rand);
      expect(split.reduce((a, b) => a + b, 0)).toBe(42);
      expect(strictlyDecreasing(split)).toBe(true);
      expect(split.at(-1)).toBeGreaterThanOrEqual(1);
    }
  });

  it('gives every simulated session a distinct id', () => {
    const ids = withBaseline([], HOUR).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
