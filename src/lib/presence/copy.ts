/**
 * Honest presence copy.
 *
 * Every string a visitor can see about who else is in the room comes from here,
 * so there is exactly one place where a number could be invented — and it
 * cannot be.
 *
 * When there is nothing true to report, these return `null` and the room says
 * nothing at all. A line of filler standing in for a fact is still a claim; an
 * empty corner is not.
 */

export type PresenceStatus =
  /** No adapter is running, or it failed to start. We know nothing. */
  | { kind: 'unavailable' }
  /** An adapter is running and reports a real count, including this visitor. */
  | { kind: 'live'; count: number };

/**
 * The badge on the entry screen.
 *
 * `count` is how many people are already working — this visitor is watching
 * from the doorway and is not among them. When nobody is in yet the badge still
 * says the room is open, which is a fact about the room rather than a claim
 * about who is in it.
 */
export function entryPresenceLine(status: PresenceStatus): string | null {
  // Not listening, so not entitled to the live dot or anything beside it.
  if (status.kind === 'unavailable') return null;
  if (status.count <= 0) return 'Room open';
  if (status.count === 1) return 'Room open · 1 focusing now';
  return `Room open · ${status.count} focusing now`;
}

/**
 * The persistent line inside the room.
 *
 * Phrased to put the visitor among the others rather than to report a
 * quantity. "313 here now" is a readout; "Focusing with 312 others" is the
 * thing the room is actually for — and the number it states is still only ever
 * one that came from sessions actually heard from.
 */
export function roomPresenceLine(status: PresenceStatus): string | null {
  if (status.kind === 'unavailable') return null;
  // Inside the room this visitor is always one of the sessions counted, so the
  // others are the count less themselves.
  const others = status.count - 1;
  if (others <= 0) return 'The room is yours for now';
  if (others === 1) return 'Focusing with 1 other';
  return `Focusing with ${others} others`;
}
