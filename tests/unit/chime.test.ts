import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { playChime, primeChime, setChimeContextSource } from '@/lib/chime';

/**
 * The chime's own context is fine on desktop, but on iOS a context with no
 * media element attached is silenced by the ring switch and suspends for good
 * once the page has been backgrounded. Where the room already has a context,
 * the chime has to ride on that one instead.
 */
class FakeParam {
  value = 1;
  setValueAtTime() {
    return this;
  }
  exponentialRampToValueAtTime() {
    return this;
  }
}
class FakeNode {
  gain = new FakeParam();
  frequency = { value: 0 };
  type = '';
  onended: (() => void) | null = null;
  connect<T>(next: T): T {
    return next;
  }
  disconnect() {}
  start() {}
  stop() {}
}
class FakeContext {
  state: 'suspended' | 'running' = 'suspended';
  currentTime = 0;
  destination = new FakeNode();
  created: FakeNode[] = [];
  resumes = 0;
  createOscillator() {
    const n = new FakeNode();
    this.created.push(n);
    return n;
  }
  createGain() {
    return new FakeNode();
  }
  async resume() {
    this.resumes++;
    this.state = 'running';
  }
}

describe('the timer chime', () => {
  let own: FakeContext[];

  beforeEach(() => {
    own = [];
    vi.stubGlobal(
      'AudioContext',
      class extends FakeContext {
        constructor() {
          super();
          own.push(this);
        }
      },
    );
  });

  afterEach(() => {
    setChimeContextSource(() => null);
    vi.unstubAllGlobals();
  });

  it('rings through the room’s context and opens none of its own', async () => {
    const room = new FakeContext();
    setChimeContextSource(() => room as unknown as AudioContext);

    await primeChime();
    expect(own).toHaveLength(0);
    expect(room.state).toBe('running');

    await playChime();
    expect(room.created.length).toBeGreaterThan(0);
  });

  it('resumes a room context that suspended while the page was away', async () => {
    const room = new FakeContext();
    setChimeContextSource(() => room as unknown as AudioContext);
    await primeChime();

    // What iOS does to a backgrounded page.
    room.state = 'suspended';
    await playChime();

    expect(room.resumes).toBe(2);
    expect(room.created.length).toBeGreaterThan(0);
  });

  it('falls back to a context of its own where the room keeps none', async () => {
    setChimeContextSource(() => null);

    await playChime();
    expect(own).toHaveLength(1);
    expect(own[0].created.length).toBeGreaterThan(0);

    // And reuses it rather than stacking up a context per chime.
    await playChime();
    expect(own).toHaveLength(1);
  });
});
