/**
 * A post's photograph: either one of its own (content/journal/images, encoded
 * by `npm run assets:journal`) or one of the room's.
 */
import { assetPath } from '@/lib/asset-path';
import { ROOMS } from '@/lib/background';
import { JOURNAL_PHOTOS } from '@/lib/journal/photo-manifest';

export interface Photo {
  dir: string;
  id: string;
  widths: readonly number[];
  lqip: string;
  focalX: number;
  focalY: number;
}

export function journalPhoto(id: string): Photo {
  const p = JOURNAL_PHOTOS.find((x) => x.id === id);
  if (!p) throw new Error(`No journal photo "${id}". Run: npm run assets:journal`);
  return { dir: '/journal/images/', id, widths: p.widths, lqip: p.lqip, focalX: 50, focalY: 50 };
}

export function roomPhoto(id: string): Photo {
  const r = ROOMS.find((x) => x.id === id);
  if (!r) throw new Error(`No room "${id}"`);
  return { dir: '/images/', id, widths: r.widths, lqip: r.lqip, focalX: r.focalX, focalY: r.focalY };
}

export function photoSrcSet(photo: Photo, format: 'avif' | 'webp'): string {
  return photo.widths.map((w) => `${assetPath(`${photo.dir}${photo.id}-${w}.${format}`)} ${w}w`).join(', ');
}

export function photoFallback(photo: Photo): string {
  return assetPath(`${photo.dir}${photo.id}-${photo.widths[photo.widths.length - 1]}.webp`);
}
