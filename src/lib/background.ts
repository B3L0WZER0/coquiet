/**
 * Which room the visitor is in.
 *
 * There are several rooms, and the one on screen is chosen from the global hour
 * — the same arithmetic as the focus notes and the music station. That matters
 * more than variety: everyone in the room at a given moment is in the *same*
 * room. If each visitor saw a different picture, "focusing together" would
 * quietly stop being true.
 *
 * The choice is made once, on the server, and passed down. Nothing recomputes
 * it on the client, so the room cannot change under someone who is working —
 * background movement during focus is the thing this whole interface avoids.
 *
 * The images themselves come from `background-manifest.ts`, which
 * `npm run assets:images` writes by reading /design-reference.
 */

import { BACKGROUND_MANIFEST, type ManifestRoom } from '@/lib/background-manifest';

export type Room = ManifestRoom;

export const ROOMS = BACKGROUND_MANIFEST;

const HOUR_MS = 60 * 60 * 1000;

/**
 * The room for the current hour.
 *
 * Derived from the hour number alone, so it needs no coordination — every
 * visitor lands on the same one, and it turns over on the hour.
 */
export function roomForHour(now: number = Date.now()): Room {
  if (ROOMS.length === 0) {
    throw new Error('No background images. Run: npm run assets:images');
  }
  const hour = Math.floor(now / HOUR_MS);
  const index = ((hour % ROOMS.length) + ROOMS.length) % ROOMS.length;
  return ROOMS[index];
}

/**
 * `sizes` for a cover-cropped full-screen image.
 *
 * In landscape the image spans the viewport width. In portrait it has to be
 * much wider than the viewport to cover the height, so asking for `100vw`
 * there picks a candidate several times too small. `178vh` is the viewport
 * height times the image's aspect ratio — the width the image actually needs.
 */
export const BACKGROUND_SIZES = '(orientation: portrait) 178vh, 100vw';

/** `srcset` string for one room in one format. */
export function srcSet(room: Room, format: 'avif' | 'webp'): string {
  return room.widths.map((w) => `/images/${room.id}-${w}.${format} ${w}w`).join(', ');
}

/** Largest generated file for a room, in a given format. */
export function largestSrc(room: Room, format: 'avif' | 'webp'): string {
  return `/images/${room.id}-${room.widths[room.widths.length - 1]}.${format}`;
}

/** Used as the `<img src>` fallback for browsers without srcset support. */
export function fallbackSrc(room: Room): string {
  return largestSrc(room, 'webp');
}

/**
 * Look a room up by id.
 *
 * Only honoured in development, via `?room=<id>`, so the rooms can be reviewed
 * and contrast-checked one at a time. In production the hour decides and
 * nothing else can, which is what keeps everyone in the same room.
 */
export function roomById(id: string | undefined, now: number = Date.now()): Room {
  if (process.env.NODE_ENV !== 'production' && id) {
    const found = ROOMS.find((r) => r.id === id);
    if (found) return found;
  }
  return roomForHour(now);
}
