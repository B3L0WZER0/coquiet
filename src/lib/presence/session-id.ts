/** This document's anonymous id.
 *
 *  Held in memory rather than sessionStorage. Chrome *copies* sessionStorage
 *  into a tab duplicated from another — and into one opened from a link on the
 *  page — so tabs opened that way all read back the same id, and the room
 *  collapses them into a single person however many are really open. An id
 *  made fresh per document is the only one that actually counts tabs.
 *
 *  A reload therefore gets a new id, which costs nothing: the old session is
 *  untracked on the way out, and expires on its own if that never lands.
 */
let current: string | null = null;

export function documentSessionId(): string {
  current ??= newId();
  return current;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `s-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
