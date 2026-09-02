import type { ChannelId } from '@/lib/channels';

/**
 * The presence contract.
 *
 * v1 ships exactly one implementation — a local adapter that syncs across tabs
 * in one browser via BroadcastChannel. Nothing in the UI knows that. A real
 * cross-device backend is a second implementation of this same interface, and
 * swapping it in should touch no component.
 */

export const ACTIVITIES = ['working', 'studying', 'reading', 'creating'] as const;
export const DRINKS = ['coffee', 'tea', 'water', 'nothing'] as const;

export type Activity = (typeof ACTIVITIES)[number];
export type Drink = (typeof DRINKS)[number];

export function isActivity(v: unknown): v is Activity {
  return typeof v === 'string' && (ACTIVITIES as readonly string[]).includes(v);
}

export function isDrink(v: unknown): v is Drink {
  return typeof v === 'string' && (DRINKS as readonly string[]).includes(v);
}

/**
 * Everything stored about one person in the room.
 *
 * Deliberately the whole list: an anonymous id, what they said they are doing,
 * what they said they are drinking, which channel they chose, and when they
 * were last heard from. No names, no addresses, no location, no history.
 */
export interface PresenceSession {
  id: string;
  activity: Activity | null;
  drink: Drink | null;
  channel: ChannelId;
  lastSeen: number;
}

/** What this visitor publishes about themselves. */
export interface OwnPresence {
  activity: Activity | null;
  drink: Drink | null;
  channel: ChannelId;
}

export interface PresenceSnapshot {
  /**
   * Live sessions. Includes this visitor once they have joined; while merely
   * observing it holds only other people.
   */
  sessions: readonly PresenceSession[];
  /** True once this visitor is one of the sessions above. */
  joined: boolean;
  /**
   * Whether the adapter is actually running. False means we know nothing, and
   * the UI must say so rather than showing a count of zero as if it were news.
   */
  available: boolean;
}

export interface PresenceProvider {
  /**
   * Watch the room without being in it.
   *
   * Used by the entry screen, so it can say how many people are working before
   * anyone commits to joining them. An observer is not announced and is not
   * counted — standing in the doorway is not the same as being in the room.
   */
  observe(): void;
  /** Announce this visitor. Called once, when they enter the room. */
  join(own: OwnPresence): void;
  /** Publish a change to this visitor's own state. */
  update(own: Partial<OwnPresence>): void;
  /** Withdraw immediately, rather than waiting for the heartbeat to lapse. */
  leave(): void;
  subscribe(fn: (snapshot: PresenceSnapshot) => void): () => void;
  snapshot(): PresenceSnapshot;
  destroy(): void;
}
