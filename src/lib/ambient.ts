/** The Ambient room: three landscapes, each with its own sound. */

import { assetPath } from '@/lib/asset-path';
import { AMBIENT_MANIFEST, type AmbientSceneFiles } from '@/lib/ambient-manifest';

export type AmbientId = 'coast' | 'forest' | 'snow';

export interface AmbientScene extends AmbientSceneFiles {
  id: AmbientId;
  /** The name on the switch. */
  label: string;
  /** What you hear, for the info panel and the lock screen. */
  sound: string;
  description: string;
}

/** Swapping a scene's footage or sound is `npm run assets:ambient`, not an
 *  edit here — this only names and describes them. */
export const AMBIENT_SCENES: readonly AmbientScene[] = [
  {
    id: 'coast',
    label: 'Blue',
    sound: 'Coastal waves',
    description: 'A hazy mountain bay at evening. Slow, distant waves.',
    ...AMBIENT_MANIFEST.coast,
  },
  {
    id: 'forest',
    label: 'Green',
    sound: 'Forest birdsong',
    description: 'A sheltered forest path. Birdsong and wind in the leaves.',
    ...AMBIENT_MANIFEST.forest,
  },
  {
    id: 'snow',
    label: 'White',
    sound: 'Snowfall',
    description: 'Slow snow over a quiet meadow. Soft wind, a frosted tree.',
    ...AMBIENT_MANIFEST.snow,
  },
];

export const DEFAULT_AMBIENT: AmbientId = 'coast';

export function isAmbientId(value: unknown): value is AmbientId {
  return typeof value === 'string' && AMBIENT_SCENES.some((s) => s.id === value);
}

export function getScene(id: AmbientId): AmbientScene {
  return AMBIENT_SCENES.find((s) => s.id === id) ?? AMBIENT_SCENES[0];
}

/** Portrait screens get the 3:4 crop; everything else the full frame. */
export const TALL_MEDIA = '(max-aspect-ratio: 4/5)';

export function scenePoster(scene: AmbientScene, format: 'avif' | 'webp', width: number | 'tall'): string {
  return assetPath(`/ambient/${scene.id}-${width}.${format}`);
}

export function scenePosterSet(scene: AmbientScene, format: 'avif' | 'webp'): string {
  return scene.posterWidths.map((w) => `${scenePoster(scene, format, w)} ${w}w`).join(', ');
}

export function sceneSound(scene: AmbientScene): string {
  return assetPath(`/ambient/${scene.id}.m4a`);
}
