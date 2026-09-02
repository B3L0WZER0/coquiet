import { afterEach, describe, expect, it, vi } from 'vitest';

import { pulse } from '@/lib/presence/aggregate';
import { SimulatedPresenceAdapter } from '@/lib/presence/simulated-adapter';
import { simulatedRoomSize } from '@/lib/presence/simulation';

/** Deterministic stand-in for Math.random, so these assertions are stable. */
function sequence(seed = 1): () => number {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

describe('the simulated room', () => {
  it('fills the room to the size asked for', () => {
    const sim = new SimulatedPresenceAdapter(300, sequence());
    sim.observe();
    // Observing shows the people already there, and does not count the watcher.
    expect(sim.snapshot().sessions).toHaveLength(300);
    expect(sim.snapshot().joined).toBe(false);
    expect(sim.snapshot().available).toBe(true);
    sim.destroy();
  });

  it('adds the visitor to the count once they join', () => {
    const sim = new SimulatedPresenceAdapter(300, sequence());
    sim.observe();
    sim.join({ activity: null, drink: null, channel: 'flow' });
    expect(sim.snapshot().sessions).toHaveLength(301);
    expect(sim.snapshot().joined).toBe(true);
    sim.destroy();
  });

  it('gives the invented people a spread of presence, not a uniform one', () => {
    const sim = new SimulatedPresenceAdapter(300, sequence());
    sim.observe();
    const p = pulse(sim.snapshot().sessions);

    expect(p.count).toBe(300);
    expect(p.showBreakdown).toBe(true);
    // Every activity and drink represented, so the panel can be judged full.
    expect(p.activities).toHaveLength(4);
    expect(p.drinks).toHaveLength(3);

    // Some people share nothing — the case most easily forgotten in a design.
    const silent = sim.snapshot().sessions.filter((s) => !s.activity && !s.drink);
    expect(silent.length).toBeGreaterThan(0);

    // And it is a spread, not four equal quarters.
    const counts = p.activities.map((a) => a.count);
    expect(Math.max(...counts)).toBeGreaterThan(Math.min(...counts) * 2);
  });

  it('reports nothing at all until it is watched', () => {
    const sim = new SimulatedPresenceAdapter(300, sequence());
    expect(sim.snapshot().available).toBe(false);
    expect(sim.snapshot().sessions).toHaveLength(0);
    sim.destroy();
  });

  it('is empty when asked for an empty room', () => {
    const sim = new SimulatedPresenceAdapter(0, sequence());
    sim.observe();
    expect(sim.snapshot().sessions).toHaveLength(0);
    expect(pulse(sim.snapshot().sessions).showBreakdown).toBe(false);
    sim.destroy();
  });
});

describe('the guard around it', () => {
  const search = (q: string) => {
    window.history.replaceState({}, '', q);
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    search('/');
  });

  it('is off unless asked for', () => {
    search('/');
    expect(simulatedRoomSize()).toBeNull();
  });

  it('is on when asked for, in development', () => {
    search('/?simulate=300');
    expect(simulatedRoomSize()).toBe(300);
  });

  it('cannot be switched on in a production build', () => {
    // The whole separation between a design tool and a fake counter is this.
    search('/?simulate=300');
    vi.stubEnv('NODE_ENV', 'production');
    expect(simulatedRoomSize()).toBeNull();
  });

  it('refuses nonsense rather than guessing', () => {
    for (const q of ['/?simulate=abc', '/?simulate=-5', '/?simulate=']) {
      search(q);
      expect(simulatedRoomSize(), q).toBeNull();
    }
  });

  it('caps how big a room it will invent', () => {
    search('/?simulate=999999');
    expect(simulatedRoomSize()).toBe(5000);
  });
});
