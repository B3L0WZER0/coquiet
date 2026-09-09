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

## Standing it up the first time

Order matters — steps 1 and 2 must both be true before step 3, or the room
loses its music.

1. **Proxy the site through Cloudflare.** In the `coquiet.app` DNS tab, turn
   the apex `A` records (and `www`) orange. A Worker route will not attach to a
   DNS-only hostname. Set SSL/TLS to **Full (strict)** — GitHub Pages presents
   a valid certificate for the domain, so this holds.
2. **Deploy the Worker** with the command above, then check it directly, before
   anything depends on it:

   ```bash
   curl -sI -H 'Range: bytes=0-1' 'https://coquiet.app/audio/Still%201.m4a'
   ```

   Want `206`, a `content-range: bytes 0-1/21580028`, and **no**
   `access-control-allow-origin` — same origin needs none.
3. **Point the app at it.** Clear the `NEXT_PUBLIC_AUDIO_BASE_URL` repository
   variable (Settings → Secrets and variables → Actions → Variables) and re-run
   the deploy. Tracks then resolve to `/audio/…` on the site's own origin.

Leave `audio.coquiet.app` and its bucket binding alone. It costs nothing and it
is the way back.

## Two things that will bite

**The cache rule is scoped to a hostname that no longer carries the traffic.**
The existing Cloudflare rule sets a year-long browser TTL for
`http.host eq "audio.coquiet.app"`. Re-scope it to
`starts_with(http.request.uri.path, "/audio/")` on the zone. It must stay
path-scoped: the site's own HTML must never inherit that TTL.

**GitHub renews its certificate through the proxy now.** Pages validates over
HTTP against the apex, so once Cloudflare sits in front, a redirect or cache
rule that swallows `/.well-known/acme-challenge/*` breaks a renewal months from
now, silently — and `.app` is HSTS-preloaded, so a dead certificate means the
site is unreachable, not merely insecure. Leave that path alone in every rule
you add.

## Rolling back

Set `NEXT_PUBLIC_AUDIO_BASE_URL` back to `https://audio.coquiet.app` and re-run
the deploy. The music leaves this Worker entirely; the proxy and route can then
come down at your leisure.
