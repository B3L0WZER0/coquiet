'use client';

import { useEffect, useState } from 'react';

import { BACKGROUND_SIZES, fallbackSrc, srcSet, type Room } from '@/lib/background';
import { chosenJazzScene } from '@/lib/jazz';

/** Matches the Ambient scenes' crossfade, so every door changes the same way. */
const CROSSFADE_MS = 2400;

/** The kissa, laid over the room photograph while Jazz plays. Picked once and
 *  kept: the scene must not change under someone who is working. */
export function JazzBackdrop({ showing }: { showing: boolean }) {
  const [scene, setScene] = useState<Room | null>(null);

  useEffect(() => {
    if (showing) setScene((s) => s ?? chosenJazzScene());
  }, [showing]);

  useEffect(() => {
    if (!showing || !scene) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = scene.chrome;
  }, [showing, scene]);

  if (!scene) return null;
  const position = `${scene.focalX}% ${scene.focalY}%`;

  return (
    <div className="absolute inset-0" style={{ ['--ambient-fade' as string]: `${CROSSFADE_MS}ms` }}>
      <div
        className="ambient-scene absolute inset-0 bg-cover"
        data-active={showing ? '' : undefined}
        data-jazz={scene.id}
        style={{ backgroundImage: `url("${scene.lqip}")`, backgroundPosition: position }}
      >
        <picture>
          <source type="image/avif" srcSet={srcSet(scene, 'avif')} sizes={BACKGROUND_SIZES} />
          <source type="image/webp" srcSet={srcSet(scene, 'webp')} sizes={BACKGROUND_SIZES} />
          <img
            src={fallbackSrc(scene)}
            alt=""
            decoding="async"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: position }}
          />
        </picture>
        {/* The rainy windows are brighter than the rooms; this keeps the
            corners' type legible. Tuned per scene in room.css. */}
        <div className="ambient-shade jazz-shade absolute inset-0" />
      </div>
    </div>
  );
}
