import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PresenceSnapshot } from '@/lib/presence/types';

vi.mock('@/lib/presence/config', () => ({ PRESENCE_URL: 'ws://presence.test/presence' }));

/** A stand-in for the browser WebSocket, recording what the adapter sends. */
class FakeSocket {
  static OPEN = 1;
  static last: FakeSocket | null = null;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}
vi.stubGlobal('WebSocket', FakeSocket);

const { WorkerPresenceAdapter } = await import('@/lib/presence/worker-adapter');

/** A rollup reporting `count` people, none in any particular bucket. */
function rollup(count: number) {
  return { count, activities: {}, drinks: {} };
}

describe('worker presence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.last = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows whatever the latest rollup reports', () => {
    const adapter = new WorkerPresenceAdapter();
    let snapshot: PresenceSnapshot = adapter.snapshot();
    adapter.subscribe((s) => {
      snapshot = s;
    });
    adapter.observe();
    const socket = FakeSocket.last!;
    expect(socket.url).toBe('ws://presence.test/presence');
    socket.open();

    socket.receive(rollup(1));
    expect(snapshot.sessions).toHaveLength(1);

    socket.receive(rollup(0));
    expect(snapshot.sessions).toHaveLength(0);
    expect(snapshot.available).toBe(true);

    adapter.destroy();
  });

  it('announces on join, not on observe, and withdraws on leave', () => {
    const adapter = new WorkerPresenceAdapter();
    adapter.observe();
    const socket = FakeSocket.last!;
    socket.open();
    expect(socket.sent).toHaveLength(0);

    adapter.join({ activity: 'working', drink: 'coffee', channel: 'flow' });
    expect(JSON.parse(socket.sent.at(-1)!)).toEqual({
      t: 'here',
      activity: 'working',
      drink: 'coffee',
    });

    adapter.leave();
    expect(JSON.parse(socket.sent.at(-1)!)).toEqual({ t: 'away' });
    adapter.destroy();
  });

  it('does not count itself twice', () => {
    const adapter = new WorkerPresenceAdapter();
    let snapshot: PresenceSnapshot = adapter.snapshot();
    adapter.subscribe((s) => {
      snapshot = s;
    });
    adapter.join({ activity: null, drink: null, channel: 'flow' });
    const socket = FakeSocket.last!;
    socket.open();
    socket.receive(rollup(3));
    expect(snapshot.sessions).toHaveLength(3);
    adapter.destroy();
  });

  it('keeps the room through a short drop, then reconnects', () => {
    const adapter = new WorkerPresenceAdapter();
    let snapshot: PresenceSnapshot = adapter.snapshot();
    adapter.subscribe((s) => {
      snapshot = s;
    });
    adapter.observe();
    const first = FakeSocket.last!;
    first.open();
    first.receive(rollup(2));

    first.onclose?.();
    expect(snapshot.available).toBe(true);
    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.last).not.toBe(first);

    vi.advanceTimersByTime(40_000);
    expect(snapshot.available).toBe(false);
    adapter.destroy();
  });

  it('pings to keep the socket alive', () => {
    const adapter = new WorkerPresenceAdapter();
    adapter.observe();
    const socket = FakeSocket.last!;
    socket.open();
    vi.advanceTimersByTime(30_000);
    expect(socket.sent).toContain('ping');
    adapter.destroy();
  });
});

describe('tab identity', () => {
  // Chrome copies sessionStorage into a duplicated tab, so an id kept there is
  // shared by every tab opened from another — and three real tabs then arrive
  // in the room as one person.
  it('does not adopt an id left in sessionStorage', async () => {
    window.sessionStorage.setItem('coquiet:session-id', 'cloned-from-another-tab');
    const { documentSessionId } = await import('@/lib/presence/session-id');
    expect(documentSessionId()).not.toBe('cloned-from-another-tab');
  });

  it('is stable within one document', async () => {
    const { documentSessionId } = await import('@/lib/presence/session-id');
    expect(documentSessionId()).toBe(documentSessionId());
  });
});
