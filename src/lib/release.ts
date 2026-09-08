/**
 * What the version chip on the entry screen says.
 *
 * Two releases, newest first — the panel shows exactly what is in this list,
 * so trimming it to two is how it stays a chip and not a changelog page.
 */

export const VERSION = '0.2.0';

/** Where "Request a feature" goes. Issues are on; the title is prefilled. */
export const FEATURE_REQUEST_URL =
  'https://github.com/B3L0WZER0/coquiet/issues/new?labels=feature+request&title=Feature+request%3A+';

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
      'Twelve new rooms opened. No rent was paid.',
      'Tracks hand over to each other instead of stopping mid-thought.',
      'A new mark, on every surface that shows one.',
    ],
  },
  {
    version: '0.1.0',
    date: 'August 2026',
    notes: [
      'A room, some music, a timer. That was the whole pitch.',
      'Presence counts real people. Zero is allowed to be zero.',
      'No chat, no cameras, no streaks. On purpose.',
    ],
  },
];

/** Named, not dated: these are intentions, not promises. */
export const COMING_SOON: { title: string; hint: string }[] = [
  { title: 'New music genres', hint: 'Rain, maybe. Piano, definitely.' },
  { title: 'iPhone app', hint: 'The same room, minus the browser.' },
  { title: 'More presence selections', hint: 'More than working, studying, reading, creating.' },
];
