import type { Metadata } from 'next';
import Link from 'next/link';

import { assetPath } from '@/lib/asset-path';
import { JOURNAL_PUBLIC } from '@/lib/journal/config';

import './journal.css';

export const metadata: Metadata = {
  robots: JOURNAL_PUBLIC ? undefined : { index: false, follow: false },
};

export default function JournalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="journal">
      <header className="journal-bar">
        {/* A plain link on purpose: the room wants a full page load, so its
            photograph chooser runs before it paints. */}
        <a href={assetPath('/')} className="journal-mark" aria-label="Coquiet — the room">
          coquiet
        </a>
        <Link href="/journal" className="journal-section">
          Journal
        </Link>
      </header>
      <main>{children}</main>
      <footer className="journal-foot">
        <p>Quiet company for focused work.</p>
        <a href={assetPath('/')}>Visit the room</a>
      </footer>
    </div>
  );
}
