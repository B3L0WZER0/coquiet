'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChannelId } from '@/lib/channels';
import { hasSupabase } from '@/lib/presence/config';
import { LocalPresenceAdapter } from '@/lib/presence/local-adapter';
import { SimulatedPresenceAdapter } from '@/lib/presence/simulated-adapter';
import { simulatedRoomSize } from '@/lib/presence/simulation';
import { SupabasePresenceAdapter } from '@/lib/presence/supabase-adapter';
import type {
  Activity,
  Drink,
  PresenceProvider,
  PresenceSnapshot,
} from '@/lib/presence/types';
import { STORAGE_KEYS, removeStored } from '@/lib/storage';
import type { PresenceStatus } from '@/lib/presence/copy';

const EMPTY: PresenceSnapshot = { sessions: [], joined: false, available: false };

/**
 * The room's presence provider.
 *
 * Three implementations of one interface, chosen here and nowhere else —
 * nothing below, and nothing in any component, knows which one it got.
 *
 * The order matters. The simulated room wins when it is asked for, and it can
 * only be asked for outside production. Otherwise a configured backend gives
 * presence across devices, and without one the local adapter gives presence
 * across tabs of a single browser.
 *
 * Falling back is not a degradation to hide. Both real adapters count only
 * sessions actually heard from, so an unconfigured site is honest — it reports
 * a smaller room, never an invented one.
 */
function createProvider(): PresenceProvider {
  const simulated = simulatedRoomSize();
  if (simulated !== null) return new SimulatedPresenceAdapter(simulated);
  if (hasSupabase()) return new SupabasePresenceAdapter();
  return new LocalPresenceAdapter();
}

interface OwnState {
  activity: Activity | null;
  drink: Drink | null;
}

/**
 * What this visitor is doing, as far as the room is concerned.
 *
 * Deliberately not remembered between visits. "Working · Coffee" is a statement
 * about right now, not a preference — carrying it over means the room announces
 * you as drinking a coffee you finished yesterday. It lasts as long as the page
 * does, and every arrival starts blank.
 */
const NOTHING_SET: OwnState = { activity: null, drink: null };

/**
 * Join the room and watch who else is in it.
 *
 * Nothing is announced until `entered` is true — a visitor still looking at the
 * entry screen has not joined anything yet.
 */
export function usePresence(entered: boolean, channel: ChannelId) {
  const providerRef = useRef<PresenceProvider | null>(null);
  const [snapshot, setSnapshot] = useState<PresenceSnapshot>(EMPTY);
  const [own, setOwn] = useState<OwnState>(NOTHING_SET);
  // Read after mount, not during render: it comes from the URL, which the
  // server cannot see, and branching on it while rendering makes the server's
  // HTML disagree with the client's.
  const [simulated, setSimulated] = useState<number | null>(null);

  useEffect(() => {
    setSimulated(simulatedRoomSize());
  }, []);

  // Earlier versions kept this in localStorage. Clear anything they left
  // behind rather than abandoning it in the visitor's browser — it is personal
  // data the room has decided not to keep.
  useEffect(() => {
    removeStored(STORAGE_KEYS.presence);
  }, []);

  // Start watching straight away, from the entry screen. Observing announces
  // nothing, so the room's count does not gain a person who is still deciding
  // whether to come in — but it does let the door say how many are already
  // working.
  useEffect(() => {
    const provider = createProvider();
    providerRef.current = provider;

    const unsubscribe = provider.subscribe(setSnapshot);
    provider.observe();

    return () => {
      unsubscribe();
      provider.destroy();
      providerRef.current = null;
      setSnapshot(EMPTY);
    };
  }, []);

  // Actually joining is a separate act, on pressing Enter.
  useEffect(() => {
    if (!entered) return;
    providerRef.current?.join({ ...NOTHING_SET, channel });
    // `channel` is deliberately not a dependency: joining happens once, and
    // later channel changes are published through `update` below instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered]);

  // Keep the room's view of which channel we are on current.
  useEffect(() => {
    providerRef.current?.update({ channel });
  }, [channel]);

  const setPresence = useCallback((activity: Activity | null, drink: Drink | null) => {
    setOwn({ activity, drink });
    providerRef.current?.update({ activity, drink });
  }, []);

  const clearPresence = useCallback(() => setPresence(null, null), [setPresence]);

  const status: PresenceStatus = snapshot.available
    ? { kind: 'live', count: snapshot.sessions.length }
    : { kind: 'unavailable' };

  return {
    snapshot,
    status,
    own,
    setPresence,
    clearPresence,
    /** Non-null only when the room is being filled with invented people. */
    simulated,
  };
}
