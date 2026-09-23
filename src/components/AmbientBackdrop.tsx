'use client';

import { useEffect, useState } from 'react';

import {
  AMBIENT_SCENES,
  TALL_MEDIA,
  getScene,
  scenePoster,
  scenePosterSet,
  type AmbientId,
  type AmbientScene,
} from '@/lib/ambient';

/** Matches the sound's own blend between scenes (FADE.scene). Stills for
 *  now; moving loops can go in over them later. */
const CROSSFADE_MS = 2400;

/** The Ambient room's landscape, laid over the room photograph. `scene` is
 *  null in the Music room, and the whole layer fades away. */
export function AmbientBackdrop({ scene }: { scene: AmbientId | null }) {
  // Scenes stay mounted once seen, so switching back is instant.
  const [seen, setSeen] = useState<AmbientId[]>([]);
  const [lastShown, setLastShown] = useState<AmbientId | null>(null);

  useEffect(() => {
    if (!scene) return;
    setLastShown(scene);
    setSeen((s) => (s.includes(scene) ? s : [...s, scene]));
  }, [scene]);

  useEffect(() => {
    if (!scene) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = getScene(scene).chrome;
  }, [scene]);

  return (
    <div
      className="ambient-backdrop absolute inset-0"
      data-showing={scene ? '' : undefined}
      style={{ ['--ambient-fade' as string]: `${CROSSFADE_MS}ms` }}
    >
      {AMBIENT_SCENES.filter((s) => seen.includes(s.id)).map((s) => (
        <SceneLayer
          key={s.id}
          scene={s}
          active={(scene ?? lastShown) === s.id}
        />
      ))}
    </div>
  );
}

function SceneLayer({ scene, active }: { scene: AmbientScene; active: boolean }) {
  const position = `${scene.focalX}% 50%`;

  return (
    <div
      className="ambient-scene absolute inset-0 bg-cover"
      data-active={active ? '' : undefined}
      data-scene={scene.id}
      style={{ backgroundImage: scene.lqip ? `url("${scene.lqip}")` : undefined, backgroundPosition: position }}
    >
      <picture>
        <source media={TALL_MEDIA} type="image/avif" srcSet={scenePoster(scene, 'avif', 'tall')} />
        <source media={TALL_MEDIA} type="image/webp" srcSet={scenePoster(scene, 'webp', 'tall')} />
        <source type="image/avif" srcSet={scenePosterSet(scene, 'avif')} sizes="100vw" />
        <source type="image/webp" srcSet={scenePosterSet(scene, 'webp')} sizes="100vw" />
        <img
          src={scenePoster(scene, 'webp', 1920)}
          alt=""
          decoding="async"
          className="ambient-still absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: position }}
        />
      </picture>
      {/* Landscapes are brighter than the rooms; this keeps the type legible
          where it sits — the top edge and the foot — and leaves the middle. */}
      <div className="ambient-shade absolute inset-0" />
    </div>
  );
}
