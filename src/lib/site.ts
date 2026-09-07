/**
 * Where this build of the site will actually live.
 *
 * Metadata is the one place where a relative URL is not good enough: an
 * og:image or a canonical link has to be absolute, because the crawler that
 * reads it has no page to resolve it against. The deploy workflow sets this to
 * the same origin it built the base path for; a local `next dev` gets
 * localhost, which is wrong for a crawler and right for a developer.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
