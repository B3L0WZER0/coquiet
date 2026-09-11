import { ROOMS, fallbackSrc, srcSet } from '@/lib/background';

/** A room photograph at a fixed aspect, over its own blurred placeholder — no layout shift. */
export function RoomPicture({
  roomId,
  alt,
  sizes,
  priority = false,
  className = '',
}: {
  roomId: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const room = ROOMS.find((r) => r.id === roomId);
  if (!room) throw new Error(`No room "${roomId}"`);

  return (
    <div className={`journal-picture ${className}`} style={{ backgroundImage: `url("${room.lqip}")` }}>
      <picture>
        <source type="image/avif" srcSet={srcSet(room, 'avif')} sizes={sizes} />
        <source type="image/webp" srcSet={srcSet(room, 'webp')} sizes={sizes} />
        <img
          src={fallbackSrc(room)}
          alt={alt}
          decoding="async"
          loading={priority ? undefined : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          style={{ objectPosition: `${room.focalX}% ${room.focalY}%` }}
        />
      </picture>
    </div>
  );
}
