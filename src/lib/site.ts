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

/**
 * Cloudflare Web Analytics, if this build was given a beacon to report to.
 *
 * Unset — every local run, every fork, every build before the token is added —
 * and nothing is loaded and nobody is counted. That is the default on purpose:
 * a visitor should only ever be measured by the one deploy that said so.
 */
export const CF_BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN || '';
