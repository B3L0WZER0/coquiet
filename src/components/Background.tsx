import {
  BACKGROUND_SIZES,
  fallbackSrc,
  largestSrc,
  srcSet,
  type Room,
} from '@/lib/background';

/**
 * The full-screen room.
 *
 * Fixed and object-fit: cover, so it fills every viewport shape without ever
 * contributing to layout — no shift when it decodes, no scrollbars.
 *
 * Placeholder and photograph share one wrapper and one focal point. Held apart
 * they were framed differently — the placeholder centred, the photograph
 * transformed and, in portrait, cropped to a different part of the frame — so
 * the room visibly jumped the instant the photograph arrived.
 *
 * Its only movement is the warm layer breathing very slowly, which reads as the
 * light changing rather than as anything moving. It is disabled entirely under
 * prefers-reduced-motion.
 */
export function Background({ room }: { room: Room }) {
  return (
    <>
      {/* Only this room is preloaded. The others are never fetched. */}
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

        {/* Warm contrast veil. Three shallow layers rather than one flat scrim,
            so the stone keeps its depth while controls stay legible.

            Kept as light as the contrast audit allows. The controls that sit over
            the brightest parts of the image — the focus note, the entry
            composition, the panels — carry their own local shade, which is what
            lets this stay a veil over the room rather than a lid on it. Run
            `npm run contrast` after touching any of these numbers. */}
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
