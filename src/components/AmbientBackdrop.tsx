'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  AMBIENT_SCENES,
  TALL_MEDIA,
  getScene,
  sceneLoop,
  scenePoster,
  scenePosterSet,
  type AmbientId,
  type AmbientScene,
} from '@/lib/ambient';

/** Matches the sound's own blend between scenes (FADE.scene). */
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
      <SceneLoop scene={scene} active={active} position={position} />
      {/* Landscapes are brighter than the rooms; this keeps the type legible
          where it sits — the top edge and the foot — and leaves the middle. */}
      <div className="ambient-shade absolute inset-0" />
    </div>
  );
}

const STILL_ONLY = '(prefers-reduced-motion: reduce)';

function subscribeMedia(onChange: () => void) {
  const queries = [STILL_ONLY, TALL_MEDIA].map((q) => window.matchMedia(q));
  queries.forEach((q) => q.addEventListener('change', onChange));
  return () => queries.forEach((q) => q.removeEventListener('change', onChange));
}

/** 'still' on the server, under reduced motion, or with Save-Data on. */
function loopShape(): 'wide' | 'tall' | 'still' {
  const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData;
  if (saveData || window.matchMedia(STILL_ONLY).matches) return 'still';
  return window.matchMedia(TALL_MEDIA).matches ? 'tall' : 'wide';
}

/** The scene's moving loop, over its still. Muted, so it may play on the
 *  front door too; it fades in only once it is really moving. */
function SceneLoop({ scene, active, position }: { scene: AmbientScene; active: boolean; position: string }) {
  const shape = useSyncExternalStore(subscribeMedia, loopShape, () => 'still' as const);
  const ref = useRef<HTMLVideoElement>(null);
  const [moving, setMoving] = useState(false);

  // Only the scene on show plays; the one leaving keeps moving through the fade.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (active) {
      // Refused in iOS Low Power Mode: the still simply stays.
      video.play().catch(() => {});
      return;
    }
    const t = window.setTimeout(() => video.pause(), CROSSFADE_MS);
    return () => window.clearTimeout(t);
  }, [active, shape]);

  if (shape === 'still' || !scene.loop) return null;

  return (
    <video
      key={shape}
      ref={ref}
      className="ambient-loop absolute inset-0 h-full w-full object-cover"
      style={{ objectPosition: position }}
      data-moving={moving ? '' : undefined}
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      disableRemotePlayback
      onPlaying={() => setMoving(true)}
    >
      <source src={sceneLoop(scene, shape, 'av1') ?? undefined} type='video/mp4; codecs="av01.0.08M.08"' />
      <source src={sceneLoop(scene, shape, 'h264') ?? undefined} type="video/mp4" />
    </video>
  );
}
