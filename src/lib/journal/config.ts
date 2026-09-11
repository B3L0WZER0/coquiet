/**
 * The journal at /journal.
 *
 * Unlisted while it is being tried out: anyone with the link can read it, but
 * it is noindex, left out of the sitemap, and not linked from the room. Flip
 * this to publish it to search engines.
 */
export const JOURNAL_PUBLIC = false;

/** Answered by workers/journal on the site's own origin — never under the base path. */
export const VOTES_API = '/api/journal/votes';

/** Link-preview card for a post, rendered by `npm run assets:journal`. */
export function cardPath(slug: string): string {
  return `/journal/cards/${slug}.jpg`;
}
