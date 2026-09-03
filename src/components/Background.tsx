'use client';

import { useEffect, useState } from 'react';

import {
  BACKGROUND_SIZES,
  fallbackSrc,
  largestSrc,
  roomById,
  roomForHour,
  srcSet,
  type Room,
} from '@/lib/background';

/** The full-screen room. */
export function Background({ buildRoom }: { buildRoom: Room }) {
  // The prerendered HTML can only carry the room of the hour the build ran in.
  // Starting from it — rather than from nothing — keeps the placeholder in the
  // first paint, which is what stops the room arriving as a flash of empty.
  const [room, setRoom] = useState(buildRoom);

  // Corrected once, on mount, and never again: the hour that matters is the one
  // the visitor arrived in, and re-reading the clock later would change the
  // room under someone who is working. Every visitor runs the same arithmetic
  // on the same hour, so they all land in the same room without a server
  // telling them which — which is the property worth keeping.
  useEffect(() => {
    // `?room=<id>` still picks one deliberately, and still only in development.
    const requested = new URLSearchParams(window.location.search).get('room') ?? undefined;
    const current = requested ? roomById(requested) : roomForHour();
    if (current.id !== buildRoom.id) setRoom(current);
  }, [buildRoom]);

  return (
    <>
      {/* Only this room is preloaded. */}
      <link
        rel="preload"
        as="image"
        type="image/avif"
        href={largestSrc(room, 'avif')}
        imageSrcSet={srcSet(room, 'avif')}
        imageSizes={BACKGROUND_SIZES}
        fetchPriority="high"
      />

      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          // The placeholder is this element's own background, so it is always
          // painted underneath the photograph rather than competing with it in
          // the positioned-descendant paint order.
          className="room-image-lqip absolute inset-0 bg-cover"
          style={{
            backgroundImage: `url("${room.lqip}")`,
            // One focal point, read by both the placeholder and the photograph.
            ['--room-focal-x' as string]: `${room.focalX}%`,
          }}
        >
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
        </div>

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
    </>
  );
}
