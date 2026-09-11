import type { Metadata } from 'next';
import Link from 'next/link';

import { ArrowUpRight } from '@/components/journal/Arrows';
import { assetPath } from '@/lib/asset-path';
import { JOURNAL_PUBLIC } from '@/lib/journal/config';
import { FEATURE_REQUEST_EMAIL } from '@/lib/release';

import './journal.css';

export const metadata: Metadata = {
  robots: JOURNAL_PUBLIC ? undefined : { index: false, follow: false },
};

export default function JournalLayout({ children }: { children: React.ReactNode }) {
  // Plain links into the room: it wants a full page load, so its photograph
  // chooser runs before it paints.
  const room = assetPath('/');

  return (
    <div className="journal">
      <header className="journal-bar">
        <div className="journal-brand">
          <a href={room} className="journal-mark" aria-label="Coquiet — the room">
            coquiet
          </a>
          <span className="journal-divider" aria-hidden="true" />
          <Link href="/journal/" className="journal-section">
            Journal
          </Link>
        </div>
        <a href={room} className="journal-pill">
          Visit the room <ArrowUpRight />
        </a>
      </header>

      <main>{children}</main>

      <footer className="journal-foot">
        <div className="journal-brand">
          <a href={room} className="journal-mark" aria-label="Coquiet — the room">
            coquiet
          </a>
          <span className="journal-divider" aria-hidden="true" />
          <p>Quiet company for focused work.</p>
        </div>
        <nav aria-label="Footer" className="journal-foot-links">
          <Link href="/journal/">Journal</Link>
          <a href={room}>The room</a>
          <a href={`mailto:${FEATURE_REQUEST_EMAIL}`}>Contact</a>
        </nav>
      </footer>
    </div>
  );
}
