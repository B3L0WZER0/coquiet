/** Pure helpers for the presence room, kept apart so they can be unit tested
 *  without the Workers runtime. */

export const ACTIVITIES = ['working', 'studying', 'reading', 'creating'];
export const DRINKS = ['coffee', 'tea', 'water'];

/** Anything longer is not something the app sends. */
const MAX_MESSAGE = 256;

/**
 * Read one client message. `here` joins or updates, `away` leaves. Returns the
 * socket's new attachment: a status object, `null` for an observer, or
 * `undefined` when the message is not understood and should be ignored.
 */
export function parseMessage(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE) return undefined;
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof msg !== 'object' || msg === null) return undefined;
  if (msg.t === 'away') return null;
  if (msg.t !== 'here') return undefined;
  return {
    activity: ACTIVITIES.includes(msg.activity) ? msg.activity : null,
    drink: DRINKS.includes(msg.drink) ? msg.drink : null,
  };
}

/** The rollup every client receives: counts, never individual sessions. */
export function tally(statuses) {
  const activities = Object.fromEntries(ACTIVITIES.map((a) => [a, 0]));
  const drinks = Object.fromEntries(DRINKS.map((d) => [d, 0]));
  let count = 0;
  for (const s of statuses) {
    if (!s) continue;
    count++;
    if (s.activity in activities) activities[s.activity]++;
    if (s.drink in drinks) drinks[s.drink]++;
  }
  return { count, activities, drinks };
}
