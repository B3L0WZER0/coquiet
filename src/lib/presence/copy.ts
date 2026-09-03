/** Honest presence copy. */

export type PresenceStatus =
  /** No adapter is running, or it failed to start. */
  | { kind: 'unavailable' }
  /** An adapter is running and reports a real count, including this visitor. */
  | { kind: 'live'; count: number };

/** The badge on the entry screen. */
export function entryPresenceLine(status: PresenceStatus): string | null {
  // Not listening, so not entitled to the live dot or anything beside it.
  if (status.kind === 'unavailable') return null;
  if (status.count <= 0) return 'Room open';
  if (status.count === 1) return 'Room open · 1 focusing now';
  return `Room open · ${status.count} focusing now`;
}

/** The persistent line inside the room. */
export function roomPresenceLine(status: PresenceStatus): string | null {
  if (status.kind === 'unavailable') return null;
  // Inside the room this visitor is always one of the sessions counted, so the
  // others are the count less themselves.
  const others = status.count - 1;
  if (others <= 0) return 'The room is yours for now';
  if (others === 1) return 'Focusing with 1 other';
  return `Focusing with ${others} others`;
}

/** A terser version for the narrow mobile top row, where the full sentence
 *  crowds the wordmark. Same honesty rules — still no number when there is
 *  nobody else to count. */
export function shortRoomPresenceLine(status: PresenceStatus): string | null {
  if (status.kind === 'unavailable') return null;
  const others = status.count - 1;
  if (others <= 0) return 'Just you';
  if (others === 1) return '1 other here';
  return `${others} others here`;
}
