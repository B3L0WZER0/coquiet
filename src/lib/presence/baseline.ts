/** The standing room: simulated people counted before anyone real arrives. */

import type { ChannelId } from '@/lib/channels';
import {
  ACTIVITIES,
  DRINKS,
  type Activity,
  type Drink,
  type PresenceSession,
} from '@/lib/presence/types';

/** The standing room moves between these across the day. */
export const BASELINE_MIN = 570;
export const BASELINE_MAX = 830;

/** Hour (UTC) the room is emptiest; it fills to its peak twelve hours later. */
export const QUIET_HOUR_UTC = 3;

/** How far the wandering sits either side of the day's curve. */
const WANDER = 12;

/** Roughly this share of it has set an activity and a drink. */
export const BASELINE_SHARED_RATIO = 0.7;

/** A fresh target size is drawn this often; the count glides between them. */
export const DRIFT_MS = 10 * 60 * 1000;

/** The pulse mix is reshuffled this often. */
export const RESHUFFLE_MS = 60 * 60 * 1000;

const CHANNELS: ChannelId[] = ['still', 'flow', 'momentum'];

/** Small seeded PRNG (mulberry32), so every visitor draws the same room. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where the day's curve sits at `now`: 0 at the quiet hour, 1 twelve hours on. */
function dayShape(now: number): number {
  const hours = now / 3_600_000 - QUIET_HOUR_UTC;
  return (1 - Math.cos((Math.PI * hours) / 12)) / 2;
}

/** How many simulated people are in the room at `now` — the same for everyone. */
export function baselineCount(now: number): number {
  const slot = Math.floor(now / DRIFT_MS);
  // A different seed stream from the mix, so size and mix don't move together.
  const wander = (s: number) => (prng(s ^ 0x9e3779b9)() * 2 - 1) * WANDER;
  const t = (now % DRIFT_MS) / DRIFT_MS;
  // Cosine easing, so the count settles at each target instead of turning sharply.
  const eased = (1 - Math.cos(Math.PI * t)) / 2;
  const drift = wander(slot) + (wander(slot + 1) - wander(slot)) * eased;

  // The day carries the shape; the wandering keeps it off a perfect curve.
  const curve = BASELINE_MIN + WANDER + (BASELINE_MAX - BASELINE_MIN - 2 * WANDER) * dayShape(now);
  return Math.round(curve + drift);
}

/** Splits `total` into `n` random counts, strictly decreasing, none below 1. */
export function rankedSplit(total: number, n: number, rand: () => number): number[] {
  // Sorted draws plus a stepped floor keep the order while the gaps vary.
  const raw = Array.from({ length: n }, rand).sort((a, b) => b - a);
  const weights = raw.map((r, i) => r + (n - 1 - i) * 0.5 + 0.2);
  const sum = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.max(1, Math.round((w / sum) * total)));

  // Rounding can leave the total off by a few, or two neighbours tied.
  counts[0] += total - counts.reduce((a, b) => a + b, 0);
  for (let pass = 0; pass < total; pass++) {
    const i = counts.findIndex((c, k) => k < n - 1 && c <= counts[k + 1]);
    if (i === -1) break;
    counts[i] += 1;
    counts[i + 1] -= 1;
  }
  return counts;
}

/** Turns per-key counts back into a flat list of that many of each key. */
export function expand<T>(keys: readonly T[], counts: number[]): T[] {
  return keys.flatMap((key, i) => Array<T>(counts[i]).fill(key));
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function buildBaseline(count: number, mixSeed: number): Omit<PresenceSession, 'lastSeen'>[] {
  const rand = prng(mixSeed);
  const shared = Math.round(count * BASELINE_SHARED_RATIO);
  const activities = expand<Activity>(ACTIVITIES, rankedSplit(shared, ACTIVITIES.length, rand));
  const drinks = shuffle(expand<Drink>(DRINKS, rankedSplit(shared, DRINKS.length, rand)), rand);

  return Array.from({ length: count }, (_, i) => ({
    id: `baseline-${i}`,
    activity: activities[i] ?? null,
    drink: drinks[i] ?? null,
    channel: CHANNELS[i % CHANNELS.length],
  }));
}

let cached: { key: string; room: Omit<PresenceSession, 'lastSeen'>[] } | null = null;

/** The real sessions with the standing room added in front of them. */
export function withBaseline(
  sessions: readonly PresenceSession[],
  now: number = Date.now(),
): PresenceSession[] {
  const count = baselineCount(now);
  const mixSeed = Math.floor(now / RESHUFFLE_MS);
  const key = `${count}:${mixSeed}`;
  if (cached?.key !== key) cached = { key, room: buildBaseline(count, mixSeed) };
  return [...cached.room.map((s) => ({ ...s, lastSeen: now })), ...sessions];
}
