import type { Metadata } from 'next';
import Link from 'next/link';

import { RoomPicture } from '@/components/journal/RoomPicture';
import { getPosts } from '@/lib/journal/posts';
import { SITE_URL } from '@/lib/site';

const TITLE = 'Journal · Coquiet';
const DESCRIPTION =
  'Short, gentle reads on focus, rest and the small habits that make work feel lighter. From Coquiet, the quiet room for focused work.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/journal' },
  openGraph: { type: 'website', siteName: 'Coquiet', title: TITLE, description: DESCRIPTION, url: '/journal' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function JournalIndex() {
  const posts = getPosts();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Coquiet Journal',
    url: `${SITE_URL}/journal`,
    description: DESCRIPTION,
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${SITE_URL}/journal/${p.slug}`,
      datePublished: p.date,
    })),
  };

  return (
    <>
      <section className="journal-intro">
        <h1 className="journal-title">Journal</h1>
        <p className="journal-lede">
          Short reads on focus, rest and the small habits that make work feel a little lighter. Best
          with a cup of something warm.
        </p>
      </section>

      <ol className="journal-list">
        {posts.map((post, i) => (
          <li key={post.slug}>
            <Link href={`/journal/${post.slug}`} className="journal-card">
              <RoomPicture
                roomId={post.room}
                alt=""
                sizes={i === 0 ? '(min-width: 48rem) 38rem, 100vw' : '(min-width: 48rem) 31rem, 100vw'}
                priority={i === 0}
              />
              <div className="journal-card-text">
                <h2>{post.title}</h2>
                <p>{post.description}</p>
                <p className="journal-meta">{post.minutes} min read</p>
              </div>
            </Link>
          </li>
        ))}
      </ol>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
