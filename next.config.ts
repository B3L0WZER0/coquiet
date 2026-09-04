import type { NextConfig } from 'next';

/**
 * GitHub Pages serves files and nothing else — no Node process, no image
 * optimiser, no request to render on. So the site is built as a static export.
 *
 * Two separate questions, deliberately driven by two separate variables:
 *
 * - STATIC_EXPORT decides whether to export at all. The deploy workflow sets
 *   it; a local `next dev` leaves it unset and gets the ordinary
 *   server-rendered app this config always described.
 * - NEXT_PUBLIC_BASE_PATH decides what the site is served *under*. A
 *   github.io project page lives at /<repo>; a custom domain lives at the
 *   root, and wants this empty.
 *
 * They were one variable once, which quietly meant "custom domain" and "no
 * static export" were the same setting — so pointing a domain here would have
 * published a site that could not be served.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const staticExport = process.env.STATIC_EXPORT === '1';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The floating dev badge sits on top of the room's bottom-left presence line.
  devIndicators: false,
  ...(staticExport
    ? {
        output: 'export' as const,
        ...(basePath ? { basePath } : {}),
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
  // Next locks a dev server to <distDir>/lock and refuses a second one in the
  // same directory. The e2e suite needs its own server — different port, no
  // Supabase — so it gets its own dist dir and can run beside the one you are
  // already developing in. Unset everywhere else, which means .next as always.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
