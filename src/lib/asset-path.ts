/**
 * Prefix for everything served out of /public.
 *
 * Empty when the site sits at a domain root — `next dev`, or any host that
 * gives Coquiet its own domain. On GitHub Pages the site lives under
 * /coquiet, and every absolute path in this codebase has to carry that.
 *
 * Next rewrites the URLs it generates itself (its own bundles, `next/link`,
 * `next/image`), but it never touches a plain string. The room photographs and
 * the audio programmes are plain strings, so they come through here instead.
 *
 * Read from the environment rather than written in, because the same source
 * has to build for both roots. `NEXT_PUBLIC_` is substituted at build time, so
 * by the time this reaches a browser it is already a constant.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** An absolute /public path, moved under the base path. */
export function assetPath(path: string): string {
  return `${BASE_PATH}${path}`;
}
