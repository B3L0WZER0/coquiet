'use client';

import { useEffect, useState } from 'react';

import { AmbientBackdrop } from '@/components/AmbientBackdrop';
import { storedChannel, useAudioState } from '@/hooks/useAudio';
import { isAmbientId } from '@/lib/ambient';
import {
  BACKGROUND_SIZES,
  chosenRoom,
  fallbackSrc,
  srcSet,
  type Room,
} from '@/lib/background';

/** The full-screen room. */
export function Background({ buildRoom }: { buildRoom: Room }) {
  // Null until the visitor's own room is known, on both the server and the
  // first client render — so hydration matches, and no photograph is requested
  // for the room the build happened to fall in. The chooser script in the
  // document's head has the right one downloading long before this runs; by
  // the time the <picture> appears its bytes are usually already here.
  const [room, setRoom] = useState<Room | null>(null);
  const { channel } = useAudioState();
  const scene = isAmbientId(channel) ? channel : null;

  // Read once, and never again: the room that is showing must not change
  // under someone who is working. Not at all while a landscape covers it —
  // asked for the first time only if the visitor goes back to Music. The
  // stored channel is checked too, because on the hydrating render the engine
  // still reports the server's default.
  useEffect(() => {
    if (scene || isAmbientId(storedChannel())) return;
    setRoom((r) => r ?? chosenRoom());
  }, [scene]);

  // iOS Safari paints its own toolbar with the page's theme colour, and on a
  // page that never scrolls it keeps that toolbar expanded permanently — so a
  // flat near-black there reads as a black bar bolted under the room. No image
  // can reach behind browser chrome, but the colour can at least be the room's
  // own, which lets the bar pass for the floor continuing past the edge. The
  // chooser has already set this; this keeps it true if the room ever changes.
  useEffect(() => {
    if (!room || scene) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = room.chrome;
  }, [room, scene]);

  return (
    <div aria-hidden="true" className="room-backdrop pointer-events-none fixed -z-10 overflow-hidden">
      <div
        // The placeholder is this element's own background, so it is always
        // painted underneath the photograph rather than competing with it in
        // the positioned-descendant paint order. The chooser sets the variable
        // before this is parsed; the build's own room is the fallback for a
        // browser that ran no script at all.
        className="room-image-lqip absolute inset-0 bg-cover"
        style={{ backgroundImage: `var(--room-lqip, url("${buildRoom.lqip}"))` }}
      >
        {room && (
          <picture>
            <source type="image/avif" srcSet={srcSet(room, 'avif')} sizes={BACKGROUND_SIZES} />
            <source type="image/webp" srcSet={srcSet(room, 'webp')} sizes={BACKGROUND_SIZES} />
            <img
              src={fallbackSrc(room)}
              alt=""
              decoding="async"
              fetchPriority="high"
              className="room-image absolute inset-0 h-full w-full object-cover"
            />
          </picture>
        )}
      </div>

      <AmbientBackdrop scene={scene} />

      {/* Warm contrast veil. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, color-mix(in oklab, var(--color-ink) 62%, transparent) 0%, color-mix(in oklab, var(--color-ink) 40%, transparent) 12%, color-mix(in oklab, var(--color-ink) 10%, transparent) 28%, color-mix(in oklab, var(--color-ink) 6%, transparent) 62%, color-mix(in oklab, var(--color-ink) 52%, transparent) 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 92% at 50% 42%, transparent 38%, color-mix(in oklab, var(--color-ink) 26%, transparent) 100%)',
        }}
      />
      <div
        className="motion-safe:animate-light absolute inset-0 mix-blend-soft-light"
        style={{ backgroundColor: 'color-mix(in oklab, var(--color-tobacco) 22%, transparent)' }}
      />
    </div>
  );
}
