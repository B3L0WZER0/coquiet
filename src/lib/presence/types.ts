import type { ChannelId } from '@/lib/channels';

/** The presence contract. */

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

/** Everything stored about one person in the room. */
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
  /** Live sessions. */
  sessions: readonly PresenceSession[];
  /** True once this visitor is one of the sessions above. */
  joined: boolean;
  /** Whether the adapter is actually running. */
  available: boolean;
}

export interface PresenceProvider {
  /** Watch the room without being in it. */
  observe(): void;
  /** Announce this visitor. */
  join(own: OwnPresence): void;
  /** Publish a change to this visitor's own state. */
  update(own: Partial<OwnPresence>): void;
  /** Withdraw immediately, rather than waiting for the heartbeat to lapse. */
  leave(): void;
  subscribe(fn: (snapshot: PresenceSnapshot) => void): () => void;
  snapshot(): PresenceSnapshot;
  destroy(): void;
}
