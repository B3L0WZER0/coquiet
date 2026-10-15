/** The Jazz room: one channel, and a kissa that changes scene with the hour. */

import { JAZZ_MANIFEST } from '@/lib/jazz-manifest';
import type { Room } from '@/lib/background';

export const JAZZ_SCENES: readonly Room[] = JAZZ_MANIFEST;

const HOUR_MS = 60 * 60 * 1000;

/** The scene for the current hour — the same for everyone, like the rooms. */
export function jazzSceneForHour(now: number = Date.now()): Room {
  if (JAZZ_SCENES.length === 0) throw new Error('No jazz scenes. Run: npm run assets:images');
  const hour = Math.floor(now / HOUR_MS);
  return JAZZ_SCENES[((hour % JAZZ_SCENES.length) + JAZZ_SCENES.length) % JAZZ_SCENES.length];
}

/** The scene the inline chooser picked, so the preload and the paint agree. */
export function chosenJazzScene(): Room {
  const id = (window as { __coquietJazz?: string }).__coquietJazz;
  return JAZZ_SCENES.find((s) => s.id === id) ?? jazzSceneForHour();
}
