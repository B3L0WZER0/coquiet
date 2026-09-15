/** The standing room: simulated people counted before anyone real arrives. */

import type { ChannelId } from '@/lib/channels';
import {
  ACTIVITIES,
  DRINKS,
  type Activity,
  type Drink,
  type PresenceSession,
} from '@/lib/presence/types';

/** How many simulated people are always in the room. */
export const BASELINE_COUNT = 72;

/** How many of them have shared what they're up to. */
export const BASELINE_SHARED = 50;

/** The mix is reshuffled this often — the same for every visitor meanwhile. */
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

function expand<T>(keys: readonly T[], counts: number[]): T[] {
  return keys.flatMap((key, i) => Array<T>(counts[i]).fill(key));
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function buildBaseline(seed: number): Omit<PresenceSession, 'lastSeen'>[] {
  const rand = prng(seed);
  const activities = expand<Activity>(ACTIVITIES, rankedSplit(BASELINE_SHARED, ACTIVITIES.length, rand));
  const drinks = shuffle(expand<Drink>(DRINKS, rankedSplit(BASELINE_SHARED, DRINKS.length, rand)), rand);

  return Array.from({ length: BASELINE_COUNT }, (_, i) => ({
    id: `baseline-${i}`,
    activity: activities[i] ?? null,
    drink: drinks[i] ?? null,
    channel: CHANNELS[i % CHANNELS.length],
  }));
}

let cached: { slot: number; room: Omit<PresenceSession, 'lastSeen'>[] } | null = null;

/** The real sessions with the standing room added in front of them. */
export function withBaseline(
  sessions: readonly PresenceSession[],
  now: number = Date.now(),
): PresenceSession[] {
  const slot = Math.floor(now / RESHUFFLE_MS);
  if (cached?.slot !== slot) cached = { slot, room: buildBaseline(slot) };
  return [...cached.room.map((s) => ({ ...s, lastSeen: now })), ...sessions];
}
