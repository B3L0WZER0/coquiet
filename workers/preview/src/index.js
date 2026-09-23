/** The preview: the static export, with /audio/* answered from R2 exactly as
 *  workers/audio answers it on coquiet.app. */

import audio from '../../audio/src/index.js';

export default {
  async fetch(request, env) {
    const response = await audio.fetch(request, env);
    const headers = new Headers(response.headers);
    headers.set('x-robots-tag', 'noindex');
    return new Response(response.body, { status: response.status, headers });
  },
};
