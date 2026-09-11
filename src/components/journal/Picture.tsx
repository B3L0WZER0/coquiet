import { photoFallback, photoSrcSet, type Photo } from '@/lib/journal/photos';

/** A photograph at a fixed aspect, over its own blurred placeholder — no layout shift. */
export function Picture({
  photo,
  alt,
  sizes,
  priority = false,
  className = '',
}: {
  photo: Photo;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`journal-picture ${className}`} style={{ backgroundImage: `url("${photo.lqip}")` }}>
      <picture>
        <source type="image/avif" srcSet={photoSrcSet(photo, 'avif')} sizes={sizes} />
        <source type="image/webp" srcSet={photoSrcSet(photo, 'webp')} sizes={sizes} />
        <img
          src={photoFallback(photo)}
          alt={alt}
          decoding="async"
          loading={priority ? undefined : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          style={{ objectPosition: `${photo.focalX}% ${photo.focalY}%` }}
        />
      </picture>
    </div>
  );
}
