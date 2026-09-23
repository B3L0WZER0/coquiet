/**
 * What the version chip on the entry screen says.
 *
 * Two releases, newest first — the panel shows exactly what is in this list,
 * so trimming it to two is how it stays a chip and not a changelog page.
 */

import { JOURNAL_PUBLIC } from '@/lib/journal/config';

export const VERSION = '0.5.0';

/** Where a request goes. A dedicated inbox, not a personal one — the address
 *  is in the page source of a public site, so it will be scraped. */
export const FEATURE_REQUEST_EMAIL = 'coquiet.app@gmail.com';

/** Used when someone leaves the summary field empty. */
export const FEATURE_REQUEST_SUBJECT = 'Feature request';

/**
 * The mail draft the request form hands to the visitor's own mail app.
 *
 * `URLSearchParams` encodes a space as `+`, which some clients paste in
 * literally; mailto wants it percent-encoded. A `+` the visitor actually typed
 * is already `%2B` by then, so swapping the bare ones is safe.
 */
export function featureRequestDraft(summary: string, detail: string): string {
  const params = new URLSearchParams({
    subject: summary.trim() || FEATURE_REQUEST_SUBJECT,
    body: detail.trim(),
  });
  return `mailto:${FEATURE_REQUEST_EMAIL}?${params.toString().replace(/\+/g, '%20')}`;
}

/** A note, or a note with one phrase in it linking to a page on the site. */
export type ReleaseNote = string | { text: string; link?: { phrase: string; path: string } };

export function noteText(note: ReleaseNote): string {
  return typeof note === 'string' ? note : note.text;
}

export interface Release {
  version: string;
  /** Shown as written; no locale formatting, so it reads the same everywhere. */
  date: string;
  notes: ReleaseNote[];
}

export const RELEASES: Release[] = [
  {
    version: '0.5.0',
    date: 'September 2026',
    notes: [
      {
        text: 'Ambient is here: ocean waves, wind in a forest, and falling snow.',
        link: { phrase: 'Ambient', path: '/ambient/' },
      },
      'Fourteen new rooms and seven new pieces of music.',
      'More focus notes and break ideas.',
    ],
  },
  {
    version: '0.3.0',
    date: 'September 2026',
    notes: [
      'Share the room with friends. Focus comes easier in good company.',
      'Plan your next session and add it straight to your calendar.',
      {
        text: 'The journal is here: short reads on focus, rest and small habits.',
        // No link while the journal is switched off — it would lead nowhere.
        link: JOURNAL_PUBLIC ? { phrase: 'journal', path: '/journal/' } : undefined,
      },
    ],
  },
];

