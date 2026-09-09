/**
 * What the version chip on the entry screen says.
 *
 * Two releases, newest first — the panel shows exactly what is in this list,
 * so trimming it to two is how it stays a chip and not a changelog page.
 */

export const VERSION = '0.2.0';

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

export interface Release {
  version: string;
  /** Shown as written; no locale formatting, so it reads the same everywhere. */
  date: string;
  notes: string[];
}

export const RELEASES: Release[] = [
  {
    version: '0.2.0',
    date: 'September 2026',
    notes: [
      'Optimized for mobile, so Coquiet feels comfortable on a smaller screen.',
      'A custom timer is here. Choose a session length that works for you.',
      'Music now transitions with gentle fades, so changes feel smooth and natural.',
    ],
  },
  {
    version: '0.1.0',
    date: 'August 2026',
    notes: [
      'Coquiet is now live for family and friends. We’re happy to share this quiet space with you.',
      'Find your focus with three music options: Still, Flow, and Momentum.',
    ],
  },
];

/** Named, not dated: these are intentions, not promises. */
export const COMING_SOON: { title: string; hint: string }[] = [
  { title: 'New music genres', hint: 'Rain, maybe. Piano, definitely.' },
  { title: 'More presence selections', hint: 'More than working, studying, reading, creating.' },
];
