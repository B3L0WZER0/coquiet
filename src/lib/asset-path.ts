/** Prefix for everything served out of /public. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** An absolute /public path, moved under the base path. */
export function assetPath(path: string): string {
  return `${BASE_PATH}${path}`;
}

/**
 * Where the music is served from, when it is not served with the site.
 *
 * The tracks are hours long and by far the heaviest thing here, so they are the
 * one asset that may need to live on object storage rather than beside the
 * pages. Unset — the default — nothing moves and the music is served from
 * /audio like every other file.
 *
 * Set it to the origin that answers for the tracks, with no trailing slash:
 * `https://audio.example.com`. The manifest's `/audio` prefix is dropped, so a
 * bucket holding the files at its root is what this expects.
 */
const AUDIO_BASE_URL = (process.env.NEXT_PUBLIC_AUDIO_BASE_URL ?? '').replace(/\/+$/, '');

/** Whether the music comes from somewhere other than the page's own origin. */
export const audioIsOffOrigin = AUDIO_BASE_URL !== '';

/** A track's URL — beside the site, or on the host holding the music. */
export function audioPath(path: string): string {
  if (!AUDIO_BASE_URL) return assetPath(path);
  return `${AUDIO_BASE_URL}${path.replace(/^\/audio/, '')}`;
}
