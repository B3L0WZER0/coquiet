import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

// A static export has no request to render on: say so, or the build refuses.
export const dynamic = 'force-static';

/** One room, one URL. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, changeFrequency: 'monthly', priority: 1 }];
}
