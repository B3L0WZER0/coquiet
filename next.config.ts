import type { NextConfig } from 'next';

/**
 * GitHub Pages serves files and nothing else — no Node process, no image
 * optimiser, no request to render on. So the site is built as a static export,
 * and lives under /coquiet rather than at a domain root.
 *
 * Both of those last two are driven by NEXT_PUBLIC_BASE_PATH, which the deploy
 * workflow sets and a local `next dev` leaves unset. Unset, this config is the
 * one it always was: a normal server-rendered app at the root. That keeps the
 * development site and any future host with its own domain working unchanged.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The floating dev badge sits on top of the room's bottom-left presence line.
  devIndicators: false,
  ...(basePath
    ? {
        output: 'export' as const,
        basePath,
        // No optimiser on a static host. The room photographs are already
        // generated at three widths in avif and webp by `npm run assets:images`
        // and served through a plain <picture>, so nothing is lost here.
        images: { unoptimized: true },
      }
    : {
        images: {
          formats: ['image/avif' as const, 'image/webp' as const],
        },
      }),
};

export default nextConfig;
