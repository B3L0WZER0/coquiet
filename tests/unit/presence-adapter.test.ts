import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXPIRY_MS } from '@/lib/presence/aggregate';
import type { PresenceSnapshot } from '@/lib/presence/types';

/** A stand-in for the one realtime channel the adapter opens. */
const channel = {
  syncHandler: null as null | (() => void),
  state: {} as Record<string, unknown[]>,
  on(_type: string, _filter: unknown, cb: () => void) {
    channel.syncHandler = cb;
    return channel;
  },
  subscribe(cb: (status: string) => void) {
    cb('SUBSCRIBED');
    return channel;
  },
  presenceState() {
    return channel.state;
  },
  track: vi.fn(async () => undefined),
  untrack: vi.fn(async () => undefined),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    channel: () => channel,
    removeChannel: () => undefined,
  }),
}));

const { SupabasePresenceAdapter } = await import('@/lib/presence/supabase-adapter');

function peer(id: string, at: number) {
  return { id, activity: null, drink: null, channel: 'flow', at };
}

describe('supabase presence expiry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    channel.state = {};
    channel.syncHandler = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // The room only ever recomputes when something happens to it, and a peer who
  // vanishes without untracking — a killed tab, a dead socket, a sleeping
  // phone — is exactly the case where nothing does. The count has to retire
  // them on its own rather than keep reporting a room that has emptied.
  it('drops a peer that stopped heartbeating, with no further sync', () => {
    const adapter = new SupabasePresenceAdapter();
    let snapshot: PresenceSnapshot = adapter.snapshot();
    adapter.subscribe((s) => {
      snapshot = s;
    });
    adapter.observe();

    channel.state = { someone: [peer('someone', Date.now())] };
    channel.syncHandler?.();
    expect(snapshot.sessions).toHaveLength(1);

    // They go quiet. No leave event ever arrives.
    vi.advanceTimersByTime(EXPIRY_MS + 10_000);
    expect(snapshot.sessions).toHaveLength(0);
    expect(snapshot.available).toBe(true);

    adapter.destroy();
  });

  it('keeps a peer that is still heartbeating', () => {
    const adapter = new SupabasePresenceAdapter();
    let snapshot: PresenceSnapshot = adapter.snapshot();
    adapter.subscribe((s) => {
      snapshot = s;
    });
    adapter.observe();

    for (let i = 0; i < 8; i++) {
      channel.state = { someone: [peer('someone', Date.now())] };
      channel.syncHandler?.();
      vi.advanceTimersByTime(15_000);
    }

    expect(snapshot.sessions).toHaveLength(1);
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
