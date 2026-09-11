import type { Metadata } from 'next';
import Link from 'next/link';

import { ArrowUpRight } from '@/components/journal/Arrows';
import { JournalInvite } from '@/components/journal/JournalInvite';
import { Picture } from '@/components/journal/Picture';
import { Unbroken } from '@/components/journal/Unbroken';
import { JOURNAL_CARD } from '@/lib/journal/config';
import { getPosts, type Post } from '@/lib/journal/posts';
import { SITE_URL } from '@/lib/site';

const TITLE = 'Journal · Coquiet';
const DESCRIPTION =
  'Short, gentle reads on focus, rest and the small habits that make work feel lighter. From Coquiet, the quiet room for focused work.';
// Named outright: an openGraph object here replaces the site's card rather than inheriting it.
const CARD = { url: JOURNAL_CARD, width: 1200, height: 630, alt: 'Coquiet Journal' };

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/journal/' },
  openGraph: {
    type: 'website',
    siteName: 'Coquiet',
    title: TITLE,
    description: DESCRIPTION,
    url: '/journal/',
    images: [CARD],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [CARD] },
};

function Kicker({ post }: { post: Post }) {
  return (
    <p className="journal-kicker">
      {post.category} · {post.minutes} min read
    </p>
  );
}

export default function JournalIndex() {
  const [lead, ...rest] = getPosts();
  // Pairs fill the grid; an odd one out gets a line of its own beneath it.
  const paired = rest.length - (rest.length % 2);
  const grid = rest.slice(0, paired);
  const tail = rest.slice(paired);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Coquiet Journal',
    url: `${SITE_URL}/journal/`,
    description: DESCRIPTION,
    blogPost: [lead, ...rest].filter(Boolean).map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${SITE_URL}/journal/${p.slug}/`,
      datePublished: p.date,
    })),
  };

  return (
    <>
      <section className="journal-intro">
        <h1 className="journal-display">Journal</h1>
        <p className="journal-lede">Short reads on focus, rest and the small habits that make work feel lighter.</p>
        <p className="journal-lede-quiet">Best with a cup of something warm.</p>
      </section>

      {lead && (
        <article className="journal-lead">
          <Link href={`/journal/${lead.slug}/`} className="journal-lead-photo" tabIndex={-1} aria-hidden="true">
            <Picture photo={lead.photo} alt="" sizes="(min-width: 48rem) 36rem, 100vw" priority />
          </Link>
          <div className="journal-lead-text">
            <Kicker post={lead} />
            <h2 className="journal-lead-title">
              <Link href={`/journal/${lead.slug}/`}>
                <Unbroken text={lead.head} />
              </Link>
            </h2>
            {lead.sub && <p className="journal-subtitle">{lead.sub}</p>}
            <p className="journal-summary">{lead.summary}</p>
            <Link href={`/journal/${lead.slug}/`} className="journal-textlink" aria-label={`Start reading: ${lead.head}`}>
              Start reading <ArrowUpRight />
            </Link>
          </div>
        </article>
      )}

      {rest.length > 0 && (
        <section className="journal-explore" aria-labelledby="journal-more">
          <h2 id="journal-more" className="journal-h2">
            More from the journal
          </h2>
          <ul className="journal-grid">
            {grid.map((p) => (
              <li key={p.slug}>
                <Link href={`/journal/${p.slug}/`} className="journal-card">
                  <Picture photo={p.photo} alt="" sizes="(min-width: 40rem) 31rem, 100vw" className="journal-card-photo" />
                  <Kicker post={p} />
                  <h3>
                    <Unbroken text={p.head} />
                  </h3>
                  <p className="journal-card-summary">{p.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
          {tail.map((p) => (
            <Link key={p.slug} href={`/journal/${p.slug}/`} className="journal-row">
              <Kicker post={p} />
              <span className="journal-row-title">
                <span>
                  <Unbroken text={p.head} />
                </span>
                <ArrowUpRight />
              </span>
            </Link>
          ))}
        </section>
      )}

      <JournalInvite />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
