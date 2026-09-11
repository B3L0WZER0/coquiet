/** Which room the visitor is in. */

import { assetPath } from '@/lib/asset-path';
import { BACKGROUND_MANIFEST, type ManifestRoom } from '@/lib/background-manifest';

export type Room = ManifestRoom;

export const ROOMS = BACKGROUND_MANIFEST;

const HOUR_MS = 60 * 60 * 1000;

/** The room for the current hour. */
export function roomForHour(now: number = Date.now()): Room {
  if (ROOMS.length === 0) {
    throw new Error('No background images. Run: npm run assets:images');
  }
  const hour = Math.floor(now / HOUR_MS);
  const index = ((hour % ROOMS.length) + ROOMS.length) % ROOMS.length;
  return ROOMS[index];
}

/** `sizes` for a cover-cropped full-screen image. */
export const BACKGROUND_SIZES = '(orientation: portrait) 178vh, 100vw';

/** `srcset` string for one room in one format. */
export function srcSet(room: Room, format: 'avif' | 'webp'): string {
  return room.widths
    .map((w) => `${assetPath(`/images/${room.id}-${w}.${format}`)} ${w}w`)
    .join(', ');
}

/** Largest generated file for a room, in a given format. */
export function largestSrc(room: Room, format: 'avif' | 'webp'): string {
  return assetPath(`/images/${room.id}-${room.widths[room.widths.length - 1]}.${format}`);
}

/** Used as the `<img src>` fallback for browsers without srcset support. */
export function fallbackSrc(room: Room): string {
  return largestSrc(room, 'webp');
}

/** Look a room up by id. */
export function roomById(id: string | undefined, now: number = Date.now()): Room {
  if (process.env.NODE_ENV !== 'production' && id) {
    const found = ROOMS.find((r) => r.id === id);
    if (found) return found;
  }
  return roomForHour(now);
}

/**
 * The room the visitor is in, as chosen by the inline chooser below.
 *
 * The two must never disagree: the chooser preloads one room's photograph and
 * the component paints another, and the visitor pays for both. So the
 * component asks the chooser what it picked rather than running the clock a
 * second time — a page open across an hour boundary would otherwise choose
 * two different rooms a few hundred milliseconds apart.
 */
export function chosenRoom(): Room {
  const id = (window as { __coquietRoom?: string }).__coquietRoom;
  return ROOMS.find((r) => r.id === id) ?? roomForHour();
}

/**
 * A script for the top of the document, ahead of everything else.
 *
 * The page is prerendered once, at build time, so the HTML can only ever carry
 * the room of the hour the deploy ran in — one hour in every ROOMS.length.
 * Every other visitor used to fetch that room's photograph at high priority,
 * throw it away, and only then — after the bundle had loaded and hydrated —
 * start fetching the one they were actually going to see.
 *
 * This runs before the document has been parsed: it picks the room from the
 * visitor's own clock, starts its photograph downloading at the earliest
 * moment there is, and hands the placeholder, the crop and the browser's
 * toolbar colour their real values so the first paint is already the right
 * room. No layout depends on any of it.
 *
 * The two custom properties go in a stylesheet of their own rather than on the
 * root element: React hydrates <html>, and a style attribute it did not render
 * is a mismatch — which it resolves by throwing the attribute away.
 */
export function roomChooserScript(): string {
  const rooms = ROOMS.map((r) => [r.id, r.focalX, r.chrome, r.lqip, r.focalY]);
  const widths = ROOMS[0].widths;
  // Built here rather than in the script: the base path is a build-time
  // setting and does not need to ship as a second copy.
  const prefix = assetPath('/images/');
  const dev = process.env.NODE_ENV !== 'production';

  // The journal shows no room, so it starts no photograph downloading.
  return `(function(){try{
if(/\\/journal(\\/|$)/.test(location.pathname))return;
var R=${JSON.stringify(rooms)},W=${JSON.stringify(widths)},P=${JSON.stringify(prefix)};
var i=Math.floor(Date.now()/3600000)%R.length;if(i<0)i+=R.length;var r=R[i];
${dev ? `var q=/[?&]room=([^&]*)/.exec(location.search);if(q){var f=R.find(function(x){return x[0]===decodeURIComponent(q[1])});if(f)r=f}` : ''}
window.__coquietRoom=r[0];
var y=document.createElement('style');
y.textContent=':root{--room-lqip:url("'+r[3]+'");--room-focal-x:'+r[1]+'%;--room-focal-y:'+r[4]+'%}';
document.head.appendChild(y);
var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=r[2];
var l=document.createElement('link');l.rel='preload';l.as='image';l.type='image/avif';
l.imageSrcset=W.map(function(w){return P+r[0]+'-'+w+'.avif '+w+'w'}).join(', ');
l.imageSizes=${JSON.stringify(BACKGROUND_SIZES)};l.fetchPriority='high';
document.head.appendChild(l);
}catch(e){}})();`;
}
