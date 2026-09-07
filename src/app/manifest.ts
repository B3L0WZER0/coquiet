import type { MetadataRoute } from 'next';

// A static export has no request to render on: say so, or the build refuses.
export const dynamic = 'force-static';

/**
 * What the room becomes when it is added to a home screen.
 *
 * Every URL here is relative on purpose. A manifest resolves its own relative
 * URLs against itself, so these keep working whether the site is served at the
 * root of a domain or under /<repo> on a github.io page — which is exactly the
 * pair of cases the deploy already switches between.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Coquiet',
    short_name: 'Coquiet',
    description: 'A quiet room for focused work.',
    start_url: '.',
    // The room is one fixed viewport and its own piece of chrome; the browser's
    // address bar is the one thing on screen that isn't part of it.
    display: 'standalone',
    orientation: 'portrait',
    // The colour behind the room while the photograph is still arriving. The
    // room itself retints the browser's toolbar per photograph at runtime; this
    // is only the still frame before any of that has happened.
    background_color: '#1a1713',
    theme_color: '#1a1713',
    categories: ['productivity', 'music', 'lifestyle'],
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
