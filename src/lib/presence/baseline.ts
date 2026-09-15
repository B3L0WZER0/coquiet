/** The standing room: simulated people counted before anyone real arrives. */

import type { ChannelId } from '@/lib/channels';
import type { Activity, Drink, PresenceSession } from '@/lib/presence/types';

/** How many simulated people are always in the room. */
export const BASELINE_COUNT = 72;

// 50 of them have shared what they're up to; the rest, like most real
// visitors, never set anything.
const STATUSES: { activity: Activity; drink: Drink; count: number }[] = [
  { activity: 'working', drink: 'coffee', count: 18 },
  { activity: 'working', drink: 'tea', count: 12 },
  { activity: 'reading', drink: 'coffee', count: 9 },
  { activity: 'reading', drink: 'tea', count: 11 },
];

const CHANNELS: ChannelId[] = ['still', 'flow', 'momentum'];

function buildBaseline(): Omit<PresenceSession, 'lastSeen'>[] {
  const out: Omit<PresenceSession, 'lastSeen'>[] = [];
  const add = (activity: Activity | null, drink: Drink | null) =>
    out.push({ id: `baseline-${out.length}`, activity, drink, channel: CHANNELS[out.length % 3] });

  for (const { activity, drink, count } of STATUSES) {
    for (let i = 0; i < count; i++) add(activity, drink);
  }
  while (out.length < BASELINE_COUNT) add(null, null);
  return out;
}

const BASELINE = buildBaseline();

/** The real sessions with the standing room added in front of them. */
export function withBaseline(
  sessions: readonly PresenceSession[],
  now: number = Date.now(),
): PresenceSession[] {
  return [...BASELINE.map((s) => ({ ...s, lastSeen: now })), ...sessions];
}
