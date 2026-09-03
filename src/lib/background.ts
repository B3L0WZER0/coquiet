/** Which room the visitor is in. */

import { assetPath } from '@/lib/asset-path';
import { BACKGROUND_MANIFEST, type ManifestRoom } from '@/lib/background-manifest';

export type Room = ManifestRoom;

export const ROOMS = BACKGROUND_MANIFEST;

const HOUR_MS = 60 * 60 * 1000;

/** The room for the current hour. */
export function roomForHour(now: number = Date.now()): Room {
  if (ROOMS.length === 0) {
    throw new Error('No background images. Run: npm run assets:images');
  }
  const hour = Math.floor(now / HOUR_MS);
  const index = ((hour % ROOMS.length) + ROOMS.length) % ROOMS.length;
  return ROOMS[index];
}

/** `sizes` for a cover-cropped full-screen image. */
export const BACKGROUND_SIZES = '(orientation: portrait) 178vh, 100vw';

/** `srcset` string for one room in one format. */
export function srcSet(room: Room, format: 'avif' | 'webp'): string {
  return room.widths
    .map((w) => `${assetPath(`/images/${room.id}-${w}.${format}`)} ${w}w`)
    .join(', ');
}

/** Largest generated file for a room, in a given format. */
export function largestSrc(room: Room, format: 'avif' | 'webp'): string {
  return assetPath(`/images/${room.id}-${room.widths[room.widths.length - 1]}.${format}`);
}

/** Used as the `<img src>` fallback for browsers without srcset support. */
export function fallbackSrc(room: Room): string {
  return largestSrc(room, 'webp');
}

/** Look a room up by id. */
export function roomById(id: string | undefined, now: number = Date.now()): Room {
  if (process.env.NODE_ENV !== 'production' && id) {
    const found = ROOMS.find((r) => r.id === id);
    if (found) return found;
  }
  return roomForHour(now);
}
