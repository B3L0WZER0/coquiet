/** Turning raw sessions into what the room shows. */

import {
  ACTIVITIES,
  DRINKS,
  type Activity,
  type Drink,
  type PresenceSession,
} from '@/lib/presence/types';

/** How often a session announces itself. */
export const HEARTBEAT_MS = 15_000;

/** How long a session survives without a heartbeat. */
export const EXPIRY_MS = 75_000;

/** Below this many people, the detailed breakdown is withheld. */
export const MIN_GROUP_FOR_BREAKDOWN = 3;

/** Drop everyone we have not heard from inside the expiry window. */
export function live(
  sessions: readonly PresenceSession[],
  now: number = Date.now(),
): PresenceSession[] {
  return sessions.filter((s) => now - s.lastSeen < EXPIRY_MS);
}

export interface RoomPulse {
  /** Total live sessions. */
  count: number;
  /** True when the room is big enough for a breakdown to be an aggregate rather than a description of someone in particular. */
  showBreakdown: boolean;
  activities: { key: Activity; count: number }[];
  drinks: { key: Exclude<Drink, 'nothing'>; count: number }[];
}

/** Counts for the Room pulse panel. */
export function pulse(sessions: readonly PresenceSession[]): RoomPulse {
  const count = sessions.length;

  const activities = ACTIVITIES.map((key) => ({
    key,
    count: sessions.filter((s) => s.activity === key).length,
  })).filter((entry) => entry.count > 0);

  const drinks = DRINKS.filter((d): d is Exclude<Drink, 'nothing'> => d !== 'nothing')
    .map((key) => ({ key, count: sessions.filter((s) => s.drink === key).length }))
    .filter((entry) => entry.count > 0);

  return {
    count,
    showBreakdown: count >= MIN_GROUP_FOR_BREAKDOWN,
    activities,
    drinks,
  };
}

/** "Working · Coffee", or just "Working", or null when nothing was chosen. */
export function presenceSummary(activity: Activity | null, drink: Drink | null): string | null {
  const parts: string[] = [];
  if (activity) parts.push(capitalise(activity));
  if (drink && drink !== 'nothing') parts.push(capitalise(drink));
  if (activity && drink === 'nothing') parts.push('Nothing');
  return parts.length > 0 ? parts.join(' · ') : null;
}

function capitalise(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}
