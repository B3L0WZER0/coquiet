/**
 * Serves the room's music at coquiet.app/audio/*, out of the R2 bucket.
 *
 * The music used to answer on a hostname of its own, audio.coquiet.app. That
 * made every track a cross-origin fetch, and because the graph reads the audio
 * to shape the fade, the element has to ask for it with CORS. An office proxy
 * that strips the CORS header off the response turns that into a room which
 * opens, shows a timer, and never makes a sound. Same hostname as the site, no
 * CORS in the exchange at all, nothing left for a proxy to strip.
 *
 * The Worker's route decides what arrives here. The rest of the site is still
 * GitHub Pages and never passes through this.
 */

const PREFIX = '/audio/';

/** A track's name never changes once filed — see scripts/audio-intake.mjs. */
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { allow: 'GET, HEAD' },
      });
    }

    const { pathname } = new URL(request.url);
    if (!pathname.startsWith(PREFIX)) return notFound();

    // The manifest percent-encodes the space in "Still 1.m4a"; the bucket holds
    // the original names, at its root — so a key never contains a slash, and
    // that is also what keeps a crafted path from reaching past the prefix.
    let key;
    try {
      key = decodeURIComponent(pathname.slice(PREFIX.length));
    } catch {
      return notFound();
    }
    if (!key || key.includes('/')) return notFound();

    const rangeHeader = request.headers.get('range');

    let object;
    try {
      object = await env.AUDIO.get(key, { range: request.headers });
    } catch (err) {
      // A range past the end of a track. R2 itself refuses it by throwing —
      // which, left alone, reaches the deck as a 500 — while the local emulator
      // clamps and hands back the whole file instead. The two disagree, so both
      // are handled: this, and the guard further down.
      if (!rangeHeader) throw err;
      const head = await env.AUDIO.head(key);
      if (!head) return notFound();
      return rangeNotSatisfiable(head.size);
    }
    if (object === null) return notFound();

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('accept-ranges', 'bytes');
    headers.set('cache-control', CACHE_CONTROL);

    const body = request.method === 'HEAD' ? null : object.body;

    // The room seeks into the middle of a piece to land every listener at the
    // same point in the programme, so a partial answer is the ordinary case
    // here, not an edge of it.
    if (rangeHeader) {
      const part = readRange(object.range, object.size);
      if (part === null || startsPastTheEnd(rangeHeader, object.size)) {
        return rangeNotSatisfiable(object.size);
      }
      const last = part.offset + part.length - 1;
      headers.set('content-range', `bytes ${part.offset}-${last}/${object.size}`);
      headers.set('content-length', String(part.length));
      return new Response(body, { status: 206, headers });
    }

    headers.set('content-length', String(object.size));
    return new Response(body, { status: 200, headers });
  },
};

function notFound() {
  return new Response('Not found', { status: 404 });
}

function rangeNotSatisfiable(size) {
  return new Response(null, {
    status: 416,
    headers: { 'content-range': `bytes */${size}`, 'accept-ranges': 'bytes' },
  });
}

/**
 * R2's own account of the slice it took, in the one shape Content-Range needs.
 *
 * The object carries every key of the range union, an absent one reading as
 * undefined rather than missing — so `'suffix' in range` is always true and
 * quietly turns the whole header into NaN. Ask what the values *are* instead.
 */
function readRange(range, size) {
  if (!range) return null;
  const { offset, length, suffix } = range;
  if (typeof offset === 'number' && typeof length === 'number') return { offset, length };
  if (typeof suffix === 'number') {
    const taken = Math.min(suffix, size);
    return { offset: size - taken, length: taken };
  }
  if (typeof offset === 'number') return { offset, length: size - offset };
  if (typeof length === 'number') return { offset: 0, length };
  return null;
}

/**
 * The one range R2 does not refuse: a start beyond the end, which it answers by
 * handing back the entire object. Left alone, a deck that seeks past a track's
 * end would be sent the whole hour under a 206 it never asked for.
 */
function startsPastTheEnd(rangeHeader, size) {
  const match = /^bytes=(\d+)-/.exec(rangeHeader.trim());
  return match !== null && Number(match[1]) >= size;
}
