# The music route

`coquiet.app/audio/*` is served by this Worker, out of the `coquiet-audio` R2
bucket. Everything else on the domain is still GitHub Pages and never touches
it.

It exists for one reason: the music has to come from the **same origin as the
page**. The audio graph reads the samples to shape the fade, so a cross-origin
track must be fetched with CORS — and an office proxy that strips the CORS
header off the response leaves a room that opens, starts its timer, and stays
silent. Same origin, no CORS in the exchange, nothing to strip.

Range requests are the load-bearing part, not a nicety: the room seeks into the
middle of a piece to land every listener at the same point in the programme.

## Deploying it

```bash
npm run audio:worker
```

`npx wrangler login` first, once, if you have never authenticated on this Mac.

To exercise it without deploying, `npx wrangler dev --local` from this folder
gives you a Worker over a local bucket — seed it with `wrangler r2 object put
--local` and check that a `Range` comes back `206` with a sane `Content-Range`.
That is worth doing after any edit here: seeking is how the room keeps listeners
together, and a wrong `Content-Range` breaks it in a way a full GET never shows.

## How it was stood up

Done on 2026-09-09; kept because rebuilding this from scratch needs the order.

1. **Proxy the site through Cloudflare.** In the `coquiet.app` DNS tab, turn
   the apex `A` and `AAAA` records orange (`www` and the TXT stay grey). A
   Worker route will not attach to a DNS-only hostname. SSL/TLS must be
   **Full (strict)** — GitHub Pages presents a valid certificate, so this
   holds, and on *Flexible* the site enters a redirect loop instead.
2. **Deploy the Worker**, then check it directly, before anything depends on it:

   ```bash
   curl -sI -H 'Range: bytes=0-1' 'https://coquiet.app/audio/Still%201.m4a'
   ```

   Want `206`, a `content-range: bytes 0-1/21580028`, and **no**
   `access-control-allow-origin` — same origin needs none.
3. **Point the app at it.** Delete the `NEXT_PUBLIC_AUDIO_BASE_URL` repository
   variable (Settings → Secrets and variables → Actions → Variables). Setting
   it to `""` is not the same thing: GitHub rejects an empty value. Deleting a
   variable does **not** trigger a build, so `gh workflow run deploy.yml`
   after.

## Two things that will bite

**Cloudflare's cache rule for the old hostname is dead weight.** It set a
year-long browser TTL for `http.host eq "audio.coquiet.app"`, a name that no
longer resolves. Delete it rather than re-scoping it to the path: this Worker
sets its own `cache-control`, so a dashboard rule would only be a second copy
of that policy, free to drift.

**GitHub renews its certificate through the proxy now.** Pages validates over
HTTP against the apex, so once Cloudflare sits in front, a redirect or cache
rule that swallows `/.well-known/acme-challenge/*` breaks a renewal months from
now, silently — and `.app` is HSTS-preloaded, so a dead certificate means the
site is unreachable, not merely insecure. Leave that path alone in every rule
you add.

## Rolling back

Not a one-liner any more. `audio.coquiet.app` was retired on 2026-09-09 once an
affected listener confirmed the fix, so the escape hatch in `audioPath()` now
has nothing to point at. Putting the music back on a hostname of its own means
rebuilding that hostname first:

1. Re-attach the custom domain: `wrangler r2 bucket domain add coquiet-audio
   --domain audio.coquiet.app --zone-id <zone>`.
2. Restore CORS — without it iOS goes silent with no error raised anywhere,
   because the graph reads the samples and a tainted node outputs nothing.
   The configuration that was in use:

   ```
   allowed_origins:  https://b3l0wzer0.github.io, https://coquiet.app,
                     https://www.coquiet.app, http://localhost:3000
   allowed_methods:  GET, HEAD
   allowed_headers:  range, content-type
   exposed_headers:  content-length, content-range, accept-ranges
   max_age_seconds:  86400
   ```

   `range` and `content-range` are the load-bearing entries: the room seeks
   into the middle of a track, so a plain GET passing CORS proves nothing.
3. Set `NEXT_PUBLIC_AUDIO_BASE_URL` to `https://audio.coquiet.app` and deploy.

Worth knowing why you would not: an office proxy that strips
`Access-Control-Allow-Origin` silences the room on that path, and that is the
whole reason this Worker exists. Fix the Worker instead.
