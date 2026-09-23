import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PresenceSnapshot } from '@/lib/presence/types';

/** A stand-in for the one realtime channel the adapter opens — it now only
 *  carries the rollup broadcast, not raw presence sync. */
const channel = {
  broadcastHandler: null as null | ((msg: { payload: unknown }) => void),
  on(_type: string, _filter: unknown, cb: (msg: { payload: unknown }) => void) {
    channel.broadcastHandler = cb;
    return channel;
  },
  subscribe(cb: (status: string) => void) {
    cb('SUBSCRIBED');
    return channel;
  },
};

/** A stand-in for the `presence_sessions` table the adapter upserts into —
 *  the rollup itself is computed server-side, not by anything under test. */
const upserts: unknown[] = [];
const deletes: string[] = [];

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    channel: () => channel,
    removeChannel: () => undefined,
    from: () => ({
      upsert: async (row: { id: string }) => {
        upserts.push(row);
        return { error: null };
      },
      delete: () => ({
        eq: async (_col: string, id: string) => {
          deletes.push(id);
          return { error: null };
        },
      }),
    }),
  }),
}));

const { SupabasePresenceAdapter } = await import('@/lib/presence/supabase-adapter');

/** A rollup broadcast reporting `count` people, none in any particular bucket
 *  — the tests below only care about the total surviving reconstruction. */
function rollup(count: number) {
  return { count, activities: {}, drinks: {} };
}

describe('supabase presence rollup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    channel.broadcastHandler = null;
    upserts.length = 0;
    deletes.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Expiry now happens server-side (the rollup function sweeps stale rows
  // before aggregating) — the adapter just has to trust what the next
  // broadcast says, with no client-side timer of its own to fall back on.
  it('drops a peer once a rollup reports the room emptied', () => {
    const adapter = new SupabasePresenceAdapter();
    let snapshot: PresenceSnapshot = adapter.snapshot();
    adapter.subscribe((s) => {
      snapshot = s;
    });
    adapter.observe();

    channel.broadcastHandler?.({ payload: rollup(1) });
    expect(snapshot.sessions).toHaveLength(1);

    channel.broadcastHandler?.({ payload: rollup(0) });
    expect(snapshot.sessions).toHaveLength(0);
    expect(snapshot.available).toBe(true);

    adapter.destroy();
  });

  it('keeps a peer the rollup keeps reporting', () => {
    const adapter = new SupabasePresenceAdapter();
    let snapshot: PresenceSnapshot = adapter.snapshot();
    adapter.subscribe((s) => {
      snapshot = s;
    });
    adapter.observe();

    for (let i = 0; i < 8; i++) {
      channel.broadcastHandler?.({ payload: rollup(1) });
      vi.advanceTimersByTime(15_000);
    }

    expect(snapshot.sessions).toHaveLength(1);
    adapter.destroy();
  });

  it('upserts a heartbeat row on join and deletes it on leave', async () => {
    const adapter = new SupabasePresenceAdapter();
    adapter.observe();
    adapter.join({ activity: 'working', drink: 'coffee', channel: 'flow' });
    await vi.advanceTimersByTimeAsync(0);
    expect(upserts).toHaveLength(1);

    adapter.leave();
    await vi.advanceTimersByTimeAsync(0);
    expect(deletes).toHaveLength(1);

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
