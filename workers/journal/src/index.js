/**
 * "This helped" votes for the journal, at coquiet.app/api/journal/votes/<slug>.
 *
 * One vote per post per visitor, where a visitor is a salted hash of their IP
 * and the post: no cookie, no account, nothing stored that leads back to a
 * person. People sharing one office IP share one vote — an undercount, never an
 * inflated one.
 */

const PREFIX = '/api/journal/votes/';
const SLUG = /^[a-z0-9-]{1,80}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const slug = url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) : '';
    if (!SLUG.test(slug)) return json({ error: 'Not found' }, 404);

    const { method } = request;
    if (!['GET', 'HEAD', 'POST', 'DELETE'].includes(method)) {
      return json({ error: 'Method not allowed' }, 405, { allow: 'GET, POST, DELETE' });
    }
    // Votes are cast from the page itself, never from another site's form.
    if ((method === 'POST' || method === 'DELETE') && request.headers.get('origin') !== url.origin) {
      return json({ error: 'Forbidden' }, 403);
    }
    if (!env.VOTE_SALT) return json({ error: 'Not configured' }, 503);

    const ip = request.headers.get('cf-connecting-ip') ?? '';
    const voter = await digest(`${env.VOTE_SALT}:${slug}:${ip}`);

    if (method === 'POST') {
      await env.DB.prepare('INSERT OR IGNORE INTO votes (slug, voter, created_at) VALUES (?1, ?2, ?3)')
        .bind(slug, voter, Date.now())
        .run();
    } else if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM votes WHERE slug = ?1 AND voter = ?2').bind(slug, voter).run();
    }

    const [total, mine] = await env.DB.batch([
      env.DB.prepare('SELECT COUNT(*) AS count FROM votes WHERE slug = ?1').bind(slug),
      env.DB.prepare('SELECT 1 AS yes FROM votes WHERE slug = ?1 AND voter = ?2').bind(slug, voter),
    ]);
    return json({ count: total.results[0].count, voted: mine.results.length > 0 });
  },
};

async function digest(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });
}
