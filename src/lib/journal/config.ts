/**
 * The journal at /journal.
 *
 * Indexed and in the sitemap, but not yet linked from the room. Set to false
 * to hide it from search engines again (noindex, out of the sitemap).
 */
export const JOURNAL_PUBLIC = true;

/** Link-preview card for a post, rendered by `npm run assets:journal`. */
export function cardPath(slug: string): string {
  return `/journal/cards/${slug}.jpg`;
}
