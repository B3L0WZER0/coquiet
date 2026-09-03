/** A simulated room, for looking at the interface at a size it has never been. */

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

/** Roughly how many people arrive per minute once the room is seeded. */
const ARRIVALS_PER_MINUTE = 24;

/** How the invented room is made up. */
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

  /** The room grows, and a few people leave. */
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
