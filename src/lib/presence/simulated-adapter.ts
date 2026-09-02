/**
 * A simulated room, for looking at the interface at a size it has never been.
 *
 * You cannot design a presence line or a Room pulse panel for three hundred
 * people by opening three tabs. This fills the room with invented sessions so
 * the layout, the counts and the breakdown can actually be judged.
 *
 * Everything in here is fake, and that is the point — which is also why it is
 * fenced off:
 *
 *  - it is only ever constructed in development, never in a production build;
 *  - it has to be asked for explicitly, with `?simulate=300`;
 *  - while it is running the room says so on screen, so a screenshot of a busy
 *    room can never be mistaken for a real one.
 *
 * It implements the same `PresenceProvider` interface as the real adapter, so
 * every component sees exactly what it would see with real people in the room.
 */

import { DEFAULT_CHANNEL, type ChannelId } from '@/lib/channels';
import {
  type Activity,
  type Drink,
  type OwnPresence,
  type PresenceProvider,
  type PresenceSession,
  type PresenceSnapshot,
} from '@/lib/presence/types';

/** How often the population changes. */
const TICK_MS = 4_000;

/**
 * Roughly how many people arrive per minute once the room is seeded.
 *
 * Set well above the rate people leave, so the count visibly climbs while you
 * watch it rather than hovering around where it started.
 */
const ARRIVALS_PER_MINUTE = 24;

/**
 * How the invented room is made up.
 *
 * Not uniform, because a uniform split is exactly what a real room never looks
 * like and would flatter the layout. Some people share nothing at all, which is
 * the case most likely to be forgotten.
 */
const ACTIVITY_WEIGHTS: Record<Activity | 'unset', number> = {
  working: 40,
  studying: 22,
  reading: 14,
  creating: 12,
  unset: 12,
};

const DRINK_WEIGHTS: Record<Drink | 'unset', number> = {
  coffee: 34,
  tea: 22,
  water: 16,
  nothing: 10,
  unset: 18,
};

const CHANNEL_WEIGHTS: Record<ChannelId, number> = {
  flow: 50,
  still: 30,
  momentum: 20,
};

function pick<T extends string>(weights: Record<T, number>, random: () => number): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function invent(index: number, random: () => number): PresenceSession {
  const activity = pick(ACTIVITY_WEIGHTS, random);
  const drink = pick(DRINK_WEIGHTS, random);
  return {
    id: `simulated-${index}`,
    activity: activity === 'unset' ? null : (activity as Activity),
    drink: drink === 'unset' ? null : (drink as Drink),
    channel: pick(CHANNEL_WEIGHTS, random),
    lastSeen: Date.now(),
  };
}

export class SimulatedPresenceAdapter implements PresenceProvider {
  private others: PresenceSession[] = [];
  private own: PresenceSession;
  private listeners = new Set<(snapshot: PresenceSnapshot) => void>();
  private timer: number | null = null;
  private observing = false;
  private joined = false;
  private nextIndex: number;
  private cached: PresenceSnapshot = { sessions: [], joined: false, available: false };

  constructor(
    seed: number,
    private readonly random: () => number = Math.random,
  ) {
    this.nextIndex = seed;
    this.own = {
      id: 'you',
      activity: null,
      drink: null,
      channel: DEFAULT_CHANNEL,
      lastSeen: Date.now(),
    };
    this.others = Array.from({ length: seed }, (_, i) => invent(i, this.random));
  }

  observe(): void {
    if (this.observing || this.joined) return;
    this.observing = true;
    this.start();
    this.publish();
  }

  join(own: OwnPresence): void {
    if (this.joined) return;
    this.own = { ...this.own, ...own, lastSeen: Date.now() };
    this.joined = true;
    this.start();
    this.publish();
  }

  private start(): void {
    if (this.timer !== null || typeof window === 'undefined') return;
    this.timer = window.setInterval(() => this.drift(), TICK_MS);
  }

  /**
   * The room grows, and a few people leave.
   *
   * Net upward, so a count watched for a while goes up — but not monotonically,
   * because a number that only ever increases reads as a counter rather than as
   * a room.
   */
  private drift(): void {
    const perTick = (ARRIVALS_PER_MINUTE * TICK_MS) / 60_000;
    const arrivals = Math.floor(perTick + (this.random() < perTick % 1 ? 1 : 0));
    const departures = this.others.length > 8 && this.random() < 0.25 ? 1 : 0;

    for (let i = 0; i < arrivals; i++) {
      this.others.push(invent(this.nextIndex++, this.random));
    }
    for (let i = 0; i < departures; i++) {
      this.others.splice(Math.floor(this.random() * this.others.length), 1);
    }

    const now = Date.now();
    for (const session of this.others) session.lastSeen = now;
    this.publish();
  }

  update(patch: Partial<OwnPresence>): void {
    this.own = { ...this.own, ...patch, lastSeen: Date.now() };
    if (!this.joined) return;
    this.publish();
  }

  leave(): void {
    if (!this.joined) return;
    this.joined = false;
    this.publish();
  }

  subscribe(fn: (snapshot: PresenceSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.cached);
    return () => this.listeners.delete(fn);
  }

  snapshot(): PresenceSnapshot {
    return this.cached;
  }

  private publish(): void {
    if (!this.joined && !this.observing) {
      this.cached = { sessions: [], joined: false, available: false };
    } else {
      this.cached = {
        sessions: this.joined
          ? [{ ...this.own, lastSeen: Date.now() }, ...this.others]
          : [...this.others],
        joined: this.joined,
        available: true,
      };
    }
    for (const fn of this.listeners) fn(this.cached);
  }

  destroy(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.observing = false;
    this.joined = false;
    this.listeners.clear();
    this.others = [];
  }
}
