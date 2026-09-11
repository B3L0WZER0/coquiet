import type { MetadataRoute } from 'next';

import { JOURNAL_PUBLIC } from '@/lib/journal/config';
import { getPosts } from '@/lib/journal/posts';
import { SITE_URL } from '@/lib/site';

// A static export has no request to render on: say so, or the build refuses.
export const dynamic = 'force-static';

/** The room, and the journal once it is public. */
export default function sitemap(): MetadataRoute.Sitemap {
  const room = { url: SITE_URL, changeFrequency: 'monthly' as const, priority: 1 };
  if (!JOURNAL_PUBLIC) return [room];
  const posts = getPosts();
  return [
    room,
    { url: `${SITE_URL}/journal`, lastModified: posts[0]?.date, changeFrequency: 'weekly', priority: 0.7 },
    ...posts.map((p) => ({ url: `${SITE_URL}/journal/${p.slug}`, lastModified: p.date, priority: 0.6 })),
  ];
}
