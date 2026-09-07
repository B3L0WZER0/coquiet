import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

// A static export has no request to render on: say so, or the build refuses.
export const dynamic = 'force-static';

/** Nothing here is private; the only thing to say is where the sitemap is. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
