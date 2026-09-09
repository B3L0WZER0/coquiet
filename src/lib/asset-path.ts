/** Prefix for everything served out of /public. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** An absolute /public path, moved under the base path. */
export function assetPath(path: string): string {
  return `${BASE_PATH}${path}`;
}

/**
 * Where the music is served from, when it is not served with the site.
 *
 * The tracks are hours long and by far the heaviest thing here, so they live on
 * object storage rather than beside the pages. In production this is left
 * **unset** on purpose: /audio is answered on the site's own origin by
 * `workers/audio`, which reads the same bucket. The files are not in /public
 * and do not need to be — a same-origin URL is the point, because the graph
 * reads the audio to shape the fade and an office proxy that strips CORS off a
 * cross-origin response leaves the room silent.
 *
 * Set it only to reach a bucket on a hostname of its own, with no trailing
 * slash: `https://audio.example.com`. The manifest's `/audio` prefix is
 * dropped, so a bucket holding the files at its root is what this expects, and
 * that host must send CORS headers. It stays wired as the way back if the
 * Worker route ever has to come down.
 */
const AUDIO_BASE_URL = (process.env.NEXT_PUBLIC_AUDIO_BASE_URL ?? '').replace(/\/+$/, '');

/** Whether the music comes from somewhere other than the page's own origin. */
export const audioIsOffOrigin = AUDIO_BASE_URL !== '';

/** A track's URL — beside the site, or on the host holding the music. */
export function audioPath(path: string): string {
  if (!AUDIO_BASE_URL) return assetPath(path);
  return `${AUDIO_BASE_URL}${path.replace(/^\/audio/, '')}`;
}
