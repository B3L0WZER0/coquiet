/**
 * The journal at /journal.
 *
 * Indexed, in the sitemap, and linked from the entry screen's top-right corner.
 * Set to false to hide it again: noindex, out of the sitemap, no link.
 */
export const JOURNAL_PUBLIC = true;

/** Link-preview card for the journal itself. */
export const JOURNAL_CARD = '/journal/cards/_journal.jpg';

/** Link-preview card for a post, rendered by `npm run assets:journal`. */
export function cardPath(slug: string): string {
  return `/journal/cards/${slug}.jpg`;
}
