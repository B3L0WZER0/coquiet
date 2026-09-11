import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft } from '@/components/journal/Arrows';
import { JournalInvite } from '@/components/journal/JournalInvite';
import { PostActions } from '@/components/journal/PostActions';
import { RoomPicture } from '@/components/journal/RoomPicture';
import { Unbroken } from '@/components/journal/Unbroken';
import { cardPath } from '@/lib/journal/config';
import { formatDate, getPost, getPosts } from '@/lib/journal/posts';
import { SITE_URL } from '@/lib/site';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  const url = `/journal/${post.slug}/`;
  const image = { url: cardPath(post.slug), width: 1200, height: 630, alt: post.alt };
  return {
    title: `${post.title} · Coquiet`,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      siteName: 'Coquiet',
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.date,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description, images: [image] },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const posts = getPosts();
  const index = posts.findIndex((p) => p.slug === slug);
  if (index < 0) notFound();
  const post = posts[index];
  // The next two along, wrapping — every post points somewhere.
  const more = [1, 2].map((n) => posts[(index + n) % posts.length]).filter((p) => p !== post);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    image: `${SITE_URL}${cardPath(post.slug)}`,
    url: `${SITE_URL}/journal/${post.slug}/`,
    mainEntityOfPage: `${SITE_URL}/journal/${post.slug}/`,
    articleSection: post.category,
    keywords: post.keywords.join(', '),
    author: { '@type': 'Organization', name: 'Coquiet', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Coquiet', url: SITE_URL },
  };

  return (
    <article className="journal-article">
      <header className="journal-article-head">
        <Link href="/journal/" className="journal-back">
          <ArrowLeft /> Journal
        </Link>
        <p className="journal-kicker">
          {post.category} · {post.minutes} min read
        </p>
        <h1 className="journal-display journal-post-title">
          <Unbroken text={post.head} />
          {/* In the heading, so the page's one <h1> still carries the whole title. */}
          {post.sub && <span className="journal-post-subtitle">{post.sub}</span>}
        </h1>
        <p className="journal-dek">{post.description}</p>
        <p className="journal-date">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
        </p>
      </header>

      <RoomPicture
        roomId={post.room}
        alt={post.alt}
        sizes="(min-width: 64rem) 64rem, 100vw"
        priority
        className="journal-hero"
      />

      <div className="journal-prose" dangerouslySetInnerHTML={{ __html: post.html }} />

      <PostActions title={post.title} />

      <JournalInvite variant="row" />

      <nav className="journal-next" aria-labelledby="journal-next">
        <h2 id="journal-next" className="journal-kicker">
          Keep reading
        </h2>
        <ul>
          {more.map((p) => (
            <li key={p.slug}>
              <Link href={`/journal/${p.slug}/`}>
                <span className="journal-next-title">
                  <Unbroken text={p.head} />
                </span>
                <span className="journal-kicker">{p.minutes} min read</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </article>
  );
}
