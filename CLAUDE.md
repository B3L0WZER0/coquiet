# Coquiet — project guide for Claude Code

**Quiet company for focused work.** One shared focus room: synchronized instrumental music, a focus timer, and light anonymous presence. No dashboards, no social features, no accounts.

Full product detail lives in `SPEC.md`. The build order lives in `PLAN.md`. Read both before starting, but only build the milestone you've been asked for.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Vitest for logic tests, Playwright for interaction tests
- No database or accounts; the only backends are two Cloudflare Workers (music and presence, below)

## Non-negotiables (apply in every milestone)

- No audio plays before the user deliberately presses "Enter the room."
- Presence shows a standing room of simulated people that follows the clock — emptiest (about 670) around 03:00 UTC, fullest (about 930) twelve hours later, wandering a few either side, and the same number for every visitor (`src/lib/presence/baseline.ts`, about 70% of them sharing an activity and a drink, reshuffled hourly but always ranked working > studying > reading > creating and coffee > tea > water), with real sessions counted on top. It is added once, in `usePresence`; adapters report only real sessions, and nothing else may pad or invent numbers.
- Don't add anything from the Non-goals list in `SPEC.md` — no accounts, avatars, chat, streaks, dashboards, etc. — even if it seems like a natural extension.
- Respect `prefers-reduced-motion` everywhere motion appears.
- Every interactive element is keyboard operable with a visible focus state.
- No layout shift from images or audio loading.

## Assets (drop these in before running Claude Code)

- Room photographs → `/design-reference/` — these are not mood board material any more; every file in that folder *is* a room the app shows. See below.
- Placeholder soundtrack → `/public/audio/placeholder.mp3` — one real file for now. Wire it to all three channels (Still / Flow / Momentum) so the channel-switching UI and crossfade logic are fully real, even though the audio content is identical across channels until final tracks exist. Keep the three channel entries in one small config object so swapping in real files later is a one-line change per channel, not a refactor.

## The logo

`assets/logo.png` and `assets/favicon.ico` are the mark as drawn — the only
hand-made icons in the repo. `npm run assets:icons` cuts every other size from
them (tab, Apple touch, the three PWA icons). Change the mark in `assets/`,
re-run that, never edit a generated icon by hand.

The share card is the one place the mark does *not* go: like the in-app
`Wordmark`, it stays typography over a photograph.

## The version chip

`src/lib/release.ts` is the whole feature: the number in the entry screen's
corner, the two releases the panel lists, and the
address a request is drafted to. Keep `RELEASES` at two — the panel is a line
in a corner, not a changelog page — and keep `VERSION` in step with
`package.json`.

The panel has two faces and shows one at a time, because stacking them made it
taller than the space above the corner it opens from. "Request a feature"
composes a `mailto:` draft in the visitor's own mail app: nothing is posted
anywhere, nothing is stored, and no backend is involved.

## Adding a background

Drop the file in `/design-reference/` — the filename becomes the room's permanent id, so name it for what it shows. One flat folder, no "done" subfolder: the folder *is* the room list, and which images are still undecided is derived from `FOCAL_X`, not from where they sit. An image with no focal point is not encoded and not put in the manifest, so dropping files there is safe and costs nothing until you get to them.

Then:

1. `npm run assets:crops` — renders a sheet per image with no focal point yet, into `/crops`. That is exactly the set you just dropped, so this is also how you ask "what's new?". Each tile is the slice the CSS will really take on a tall phone, with the entry copy's own footprint shaded on top.
2. Pick the tile that keeps the room legible and put its number in `FOCAL_X` in `scripts/focal-points.mjs`. Favour a frame where a person is visible, and prefer one who is *not* in the shaded band — the headline sits over the bottom half of a phone screen. The tiles step by 10, but any number works — when the tile you want cuts the person at its edge, try the number between. Leave a comment when the choice is a compromise.
3. `npm run assets:images` — encodes the sizes and rewrites `src/lib/background-manifest.ts`. It skips rooms whose files are already newer than their source, so this costs about three seconds per new room; `--force` re-encodes everything, for when the encoder settings change.
4. `npm run contrast` (needs a dev server) — the text sits over the photograph, so a new room can fail AA on its own. Every element must pass, except the few deliberately shipped failures listed in `ACCEPTED` in the script — each pinned to one room, one text and a floor it may not drop below. It audits only what has changed since it last passed: a new room costs about fifteen seconds, while changing anything under `src/` re-audits all of them (three minutes, four at a time) — the cache is keyed on the room's image plus all of `src/` except the manifest.
5. Look at it: `http://localhost:3000/?room=<id>` at a phone size, once the photograph has loaded (the blurred placeholder shows first). Screenshot at full scale — a downscaled capture can catch the placeholder and read as a bug that isn't there. The crop sheet's shaded band is approximate: check on the real page whether a head clears the headline.
6. Commit the source image, `public/images/<id>-*`, `focal-points.mjs` and the manifest together, and push.

`FOCAL_Y` exists but is almost never worth setting: a 16:9 photograph fills the height exactly on a phone and on any window narrower than 16:9, so nothing is cropped vertically there. It only bites past 16:9 — an ultrawide 2560×1080 loses about a fifth of the height. `npm run assets:crops -- --wide` sweeps that axis.

The Ambient scenes (coast, forest, snow) are not rooms and don't go through this: they are built from `/ambient-inbox/src` by `npm run assets:ambient`, with their own focal point in `src/lib/ambient-manifest.ts`. A scene moves when `<id>.mp4` sits beside its still: the script folds the clip into a seamless loop and uploads it to R2, where it plays over the still (never under reduced motion or Save-Data). All three scenes move, slowed before they go in (snow and coast 0.67×, forest 0.33× — its ferns and mist read as rushed any faster). If the footage is framed differently from the still, set `crop` on the scene so the poster doesn't jump when the video fades in (snow, forest) — or replace the still with the footage's frame at 1.5 s, where the folded loop starts (coast).

## Today's line

The quote button in the room (`src/lib/daily-quote.ts`): one real quote a day, the same for everyone, starting 1 October 2026 and wrapping round when the list runs out (94 lines, so early January 2027). Every entry needs an author and a source with its year — if you can't source it, leave it out; quote sites are full of fakes. Alternate calm lines with energising ones, never hustle, and never the same author two days running (a test checks). Sharing sends `“line” — Author` and a `Shared from coquiet.app` credit (`quoteShareText`) as text only — never a `url`, which apps turn into a link card; the clipboard fallback also carries HTML so coquiet.app is a link.

## The journal

`/journal/` — short reads on focus, rest and small habits, for people and for search. Indexed, in the sitemap, and linked from the entry screen's top-right corner — not from inside the room (`JOURNAL_PUBLIC` in `src/lib/journal/config.ts` turns all three off). Share is the only action on a post: no votes, likes or comments.

A post is `content/journal/NN-slug.md`. The slug is its permanent URL. Front matter: `title` (split at its colon into title and subtitle), `description` (the search snippet, 70–165 characters; aim for 150–160, Bing flags shorter ones), `summary` (one line for cards), `category`, `date`, `alt`, and either `image` (a photo in `content/journal/images/`, with an optional wider `hero`) or `room`, and optionally `door: ambient` for a post about sound, so its closing invite opens `/ambient/` instead of the music door. In the body, `>` makes the "try this" box, with a leading `**Label:**` as its heading, and `>>` makes a pull quote. After adding a post or photo, run `npm run assets:journal` to encode the photos and render the preview cards, then `npm test`.

## Where the music comes from

The tracks are not in the repo. They live in the `coquiet-audio` R2 bucket, and
`workers/audio` serves them at `coquiet.app/audio/*` — **the same origin as the
page**, which is the whole point. The graph reads the samples to shape the fade,
so a cross-origin track has to be fetched with CORS, and an office proxy that
strips that header leaves a room that opens, starts its timer, and never makes a
sound. Same origin, nothing to strip.

So `NEXT_PUBLIC_AUDIO_BASE_URL` stays unset in production. It is still wired
(`audioPath()` in `src/lib/asset-path.ts`) as the way back to a bucket on its own
hostname. Range requests are load-bearing, not a nicety — the room seeks into the
middle of a piece to land everyone at the same point in the programme. Runbook
and the two traps are in `workers/audio/README.md`.

## Presence

Presence sits behind the `PresenceProvider` interface
(`src/lib/presence/types.ts`), and `usePresence` picks the adapter:

- **`WorkerPresenceAdapter`** when `NEXT_PUBLIC_PRESENCE_URL` is set (a GitHub
  repository variable, `/presence` in production). One WebSocket to
  `workers/presence` — a Cloudflare Durable Object at `coquiet.app/presence`,
  same origin as the page, like the music.
- **`LocalPresenceAdapter`** otherwise: `BroadcastChannel`, real across tabs of
  one browser. Local dev and the Playwright suite use this, so tests count only
  the pages they open.

How the Worker stays on the free plan, which is the reason it exists (Supabase
heartbeats outgrew theirs): an open socket *is* the heartbeat, so nothing is
written per visitor per tick. Clients ping every 30s and the runtime answers
without waking the object; a minute's alarm drops sockets silent for 150s;
changes settle for 2s and go out as one rollup of counts — never anyone's own
session. Don't add per-visitor polling or storage writes.

- Adapters report real sessions only; the standing room is added on top in
  `usePresence`, never inside an adapter.
- The entry screen *observes* the room without joining it, so it can say how
  many are already working without counting someone still reading the door.
- A dropped socket keeps showing the last room for a 40s grace window (iOS
  suspends it on every tab switch), then says the room is unavailable rather
  than empty.
- `npm run room` (`-- --watch`) prints the live count; `npm run
  presence:worker` deploys. Cloudflare is the diego.beglinger@gmail.com
  account — wrangler logged into any other fails with auth error 10000.
- Free plan: 100,000 Durable Object requests a day. Metrics are under Workers
  & Pages → coquiet-presence; past that, Workers Paid is $5 a month.

## Working style

Build and verify one milestone from `PLAN.md` at a time. Don't start the next milestone until the current one's relevant acceptance criteria (listed in `SPEC.md`) are actually met — show me what changed and how to check it before moving on.

## Context budget

Every session pays a fixed token cost for tool schemas plus whatever it reads. Keep both down:

- Don't `cat` a whole file to find a few lines — `grep -n` first, then `Read` with `offset`/`limit` on the range you need.
- Prefer `Edit` over Bash/`sed` rewrites of files you've already read — a Bash-made edit forces the harness to re-paste the whole changed file back into context; an `Edit` doesn't.
- Screenshot at `scale: 0.5` unless you need to read fine text or judge pixel-level detail.
- Comments in this repo should be short — say *why*, not an essay. Don't reintroduce long rationale blocks.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
