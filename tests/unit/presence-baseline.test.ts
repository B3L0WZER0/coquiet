import { describe, expect, it } from 'vitest';

import { pulse } from '@/lib/presence/aggregate';
import { BASELINE_COUNT, withBaseline } from '@/lib/presence/baseline';
import type { PresenceSession } from '@/lib/presence/types';

const real: PresenceSession = {
  id: 'real',
  activity: 'studying',
  drink: 'water',
  channel: 'still',
  lastSeen: 0,
};

describe('standing room', () => {
  it('is 72 people, with real sessions counted on top', () => {
    expect(BASELINE_COUNT).toBe(72);
    expect(withBaseline([])).toHaveLength(72);
    expect(withBaseline([real])).toHaveLength(73);
    expect(withBaseline([real]).at(-1)).toBe(real);
  });

  it('has 50 people working or reading over coffee or tea', () => {
    const shared = withBaseline([]).filter((s) => s.activity !== null);
    expect(shared).toHaveLength(50);
    expect(shared.every((s) => ['working', 'reading'].includes(s.activity!))).toBe(true);
    expect(shared.every((s) => ['coffee', 'tea'].includes(s.drink!))).toBe(true);
  });

  it('gives every simulated session a distinct id', () => {
    const ids = withBaseline([]).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('fills the room pulse', () => {
    const p = pulse(withBaseline([real]));
    expect(p.count).toBe(73);
    expect(p.showBreakdown).toBe(true);
  });
});
