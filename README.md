# coquiet

**Quiet company for focused work.**

One shared room: synchronised instrumental music, a focus timer, and light
anonymous presence. No accounts, no chat, no dashboards.

---

## Running it

No external service, API key, database or realtime provider is required. Clone,
install, run.

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:3000>.

Nothing plays until you press **Enter the room** — that is the point at which
audio is first allowed to exist.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest — timer, audio engine, presence |
| `npm run test:e2e` | Playwright — the entry → play → switch → timer path |
| `npm run contrast` | WCAG AA audit across every room (dev server must be running) |
| `npm run assets:images` | Regenerate the responsive background set |
| `npm run assets:audio` | Rebuild the audio manifest from `public/audio` |

`npm run test:e2e` needs browsers once: `npx playwright install chromium`.

### On linting

There is no ESLint step. The project is on TypeScript 7, and `typescript-eslint`
does not support it yet, so `eslint-config-next` cannot load. Rather than
downgrade the compiler to satisfy the linter, the quality gates here are
`npm run typecheck` and the two test suites. If you want ESLint back, pin
`typescript` to `^6` and add `eslint-config-next`.

---

## Replacing the assets

### The rooms

There are several rooms, and the one on screen is chosen from the global hour —
the same arithmetic as the focus notes and the music station. Everyone arriving
in the same hour is given the *same* room; if each visitor saw a different
picture, "focusing together" would quietly stop being true. The choice is made
once, on the server, and passed down: nothing recomputes it on the client, so
the room cannot change under someone who is working.

To add or remove a room, add or remove a file in `design-reference/` and run:

```bash
npm run assets:images
```

That writes `public/images/<id>-{640,1024,1600}.{avif,webp}` for every source
and generates [`src/lib/background-manifest.ts`](src/lib/background-manifest.ts),
which is the only place the app learns what exists. **Name files meaningfully** —
the filename becomes the room's stable id.

Two things the script cannot work out for you:

- **The portrait focal point.** A phone shows a narrow vertical slice of a 16:9
  frame, and which part it lands on has to be chosen by eye. Set it in `FOCAL_X`
  in [`scripts/generate-images.mjs`](scripts/generate-images.mjs); anything
  missing defaults to the middle, which is rarely right, and the script says so.
  To choose one, render the image at several focal points and pick.
- **Whether the veil still works.** The rooms differ enormously in brightness,
  and a veil tuned on a dim one fails over a sunlit one — two of these rooms
  have a bright window exactly where the wordmark sits, which dropped it to
  2.25:1. `npm run contrast` audits **every room**, so run it after adding one.

In development, `?room=<id>` picks one deliberately — useful for reviewing a
single room. It is ignored in production, where the hour decides and nothing
else can.

**Supply something large.** The current sources are 1672px wide, so on a Retina
display the image is being upscaled. 3000px or wider is worth it.

Only the chosen room is preloaded or fetched; the others cost nothing but disk.

### The music

Each channel is a **programme** — an ordered list of pieces that plays through
and then repeats — not a single track. Flow currently holds two, Still and
Momentum one each.

To add or change music, name the file after its channel and a number and drop it
into `public/audio/`:

```
public/audio/
  Still 1.mp3
  Flow 1.mp3
  Flow 2.mp3
  Momentum 1.mp3
```

Then run:

```bash
npm run assets:audio
```

That scans the folder, groups files by channel, orders them by number and reads
each duration from the file itself, writing
[`src/lib/audio-manifest.ts`](src/lib/audio-manifest.ts). Nothing else needs
touching — [`src/lib/channels.ts`](src/lib/channels.ts) builds the three
channels from whatever the manifest holds.

The numbers only decide the order, so they need not start at one or be
contiguous. Files that do not match the pattern are listed as ignored rather
than silently dropped, and the script fails if a channel ends up with no music
at all.

**Durations are read, never typed.** They are what keeps listeners together:
every visitor works out where the programme is from these numbers and their own
clock, as

```
elapsed = (Date.now() - epochMs) % totalProgrammeLength
```

then walks the list to find which piece that lands in and how far into it. A
wrong duration would silently pull a channel out of sync for everyone, which is
exactly the kind of bug nobody reports.

`epochMs` in `channels.ts` is the fixed reference point that sum counts from.
All three channels share one today; giving a channel its own simply starts its
programme at a different point.

When a piece ends the room asks the station clock again rather than stepping to
"the next track", so a deck that stalled or drifted cannot compound the error.
There is a short gap at the handover while the next file starts — a second or so,
once an hour.

### The words

- Focus notes and break suggestions: [`src/lib/notes.ts`](src/lib/notes.ts).
  Both are plain arrays; add, remove or rewrite freely. The note for a given
  hour is chosen from the hour number, so everyone sees the same one.
- Presence copy: [`src/lib/presence/copy.ts`](src/lib/presence/copy.ts). Every
  string about who is in the room comes from here, so there is exactly one place
  a number could be invented — and it cannot be.

### The support link

`Buy me a coffee` sits at the foot of the entry screen and nowhere else. Point
it at your own page in [`src/lib/support.ts`](src/lib/support.ts); set it to an
empty string and it does not render at all, which is the right behaviour for a
fork that has no such page.

It is deliberately not in the room. `SPEC.md` lists in-room advertising under
its non-goals, all six control positions are spoken for, and a room built for
concentration should not ask its visitors for anything while they are
concentrating. The entry screen is the one surface a visitor sees before any of
that begins.

### What is remembered between visits

Only the music channel and the volume, which `SPEC.md` asks for and which are
genuine preferences. Everything else is a statement about the current visit and
resets: the focus timer, its durations, and your personal presence. A stored
value written by an earlier version is cleared on load rather than adopted.

---

## Music licensing

⚠️ **The current tracks are not cleared for distribution.**

The four files in `public/audio/` were supplied for local development. Their
titles, from their own tags:

| File | Title in tags |
| --- | --- |
| `Still 1.mp3` | Acoustic Guitar for Overthinkers \| Forest Soundscape & Ambient Tones |
| `Flow 1.mp3` | Classical Tones for Deep Thinkers \| Felt Piano & Cello |
| `Flow 2.mp3` | music for overthinkers \| felt piano & cello for deep focus |
| `Momentum 1.mp3` | Minimal Neoclassical Guitar & Piano for Quiet Minds |

**No licence for public deployment has been established for any of them, and
this repository makes no claim to them.** Before deploying anywhere public,
replace them with music you own or have licensed for streaming, and record the
licence here.

The YouTube link in `SPEC.md` is a *mood reference only*. Do not download,
isolate or restream its audio.

### Size

The four files total **about 540 MB** at 320 kbps. This matters in two places
and not in a third:

- **Git.** Every one is over GitHub's 100 MB per-file limit and will be rejected
  by a normal `git push`. Either keep audio out of the repository and serve it
  from object storage, or re-encode before committing.
- **Bandwidth.** 320 kbps is roughly 40 kB/s per listener, or about 144 MB per
  listening hour, per person. Re-encoding to 128 kbps stereo is ample for
  ambient listening and cuts both figures to around 40% — run the files through
  `ffmpeg -i in.mp3 -b:a 128k out.mp3` and re-run `npm run assets:audio` so the
  durations are re-read.
- **Not latency.** Playback streams via range requests and seeks straight to the
  station position, so file size does not delay entry.

---

## How it is put together

```
src/
  app/            layout, page, design tokens and room grid
  components/     the room, the entry layer, controls, icons
  hooks/          audio, timer, presence, focus note, idle dim
  lib/
    channels.ts       per-channel config + shared-station maths
    audio-engine.ts   two-deck playback, fades, channel handover
    timer.ts          pure timer logic over a serialisable session
    notes.ts          focus notes, break suggestions
    chime.ts          synthesised two-tone chime
    presence/         provider interface, local adapter, aggregation, copy
scripts/
  generate-images.mjs  responsive AVIF/WebP from a source image
  contrast-check.mjs   WCAG AA audit against the rendered background
tests/
  unit/           Vitest: timer, audio/channel state, presence expiry
  e2e/            Playwright: the critical path, keyboard access, reduced
                  motion, no-scroll, layout shift
```

A few decisions worth knowing about:

**The audio engine owns two `<audio>` elements for the life of the page** and
swaps their roles on every channel change, so switching never creates an element
and nothing leaks. Volume is the product of three independent factors — the
level you chose, the current fade, and the break duck — which is what stops a
channel change from overwriting your setting or a pause from cancelling a break.

**Changing channel is a handover, not a blend.** The outgoing piece leaves over
800ms on a curve that drops away early, and the incoming one is only let in for
the last 350ms of that, by which point the old one is under 15% and effectively
inaudible. Blending the two was right while every channel played the same file —
there was nothing to muddle. With three genuinely different pieces, two seconds
of both at once is just two pieces of music fighting each other. This is a
deliberate departure from acceptance criterion 6 in `SPEC.md`, which asks for a
2–3s crossfade; the overlap is kept precisely so the room never actually falls
silent, which is the part of that criterion worth keeping.

**Fades are driven by timers, not `requestAnimationFrame`.** A hidden tab is
served no animation frames at all, which froze fades mid-flight and could leave
the music stuck at silence. Timers are only throttled, so a fade in a background
tab becomes coarse but always finishes.

**The timer stores the timestamp a phase ends at**, never a countdown to be
decremented on schedule. A tab that slept through a whole focus stretch works
out where it is by reading the clock once.

**Nothing about the timer outlives the page.** Arriving in the room means
arriving at a stopped clock — neither a session in progress nor a custom length
is carried over. This is a deliberate departure from `SPEC.md`, which asks under
acceptance criterion 10 for an active session to be restored after a refresh;
the cost is that an accidental reload loses a stretch in progress. Accuracy
through backgrounding and device sleep is unaffected, because that comes from
the end timestamp rather than from persistence.

**The engine is a module singleton, not component state.** Tying it to a
component means React's development double-mount tears it down between the two
mounts — and in production any remount would cut the music.

**The chime's audio context is built during a user gesture**, on entering the
room and again on pressing Start. Created lazily when the timer fires it would
be created outside any gesture, and browsers may hand it back suspended and
refuse to resume — a focus stretch that ends in silence. It is primed on entry
as well as on Start so that the context is live before any chime can be due,
whichever of the two happened most recently.

---

## Presence, and adding a real backend later

Presence in v1 is **real, but scoped to one browser**. Every tab announces
itself on a `BroadcastChannel`, heartbeats every 15s, and is forgotten 75s after
it goes quiet. Open two tabs and the count and the Room pulse are genuinely
live.

There are two ways to be attached to the room, and the difference matters:

- **Observing** (`observe()`) opens the channel and listens, announcing nothing.
  The entry screen does this, so its badge can say how many people are already
  working. A watcher is not in the room and is not in its count.
- **Joining** (`join()`) announces this visitor. That happens on pressing
  *Enter the room*, and not before.

Getting that boundary wrong would put a number in front of everyone else that
included people who never came in. **No number is ever invented**: with no adapter running the room says "The
quiet room is open.", and with only your own tab it says "The room is yours for
now." Neither line promises that anyone else is coming, because the room has no
way to know that.

To make presence work across different people's devices, add a **second
implementation of `PresenceProvider`** — the interface in
[`src/lib/presence/types.ts`](src/lib/presence/types.ts):

```ts
interface PresenceProvider {
  join(own: OwnPresence): void;
  update(own: Partial<OwnPresence>): void;
  leave(): void;
  subscribe(fn: (snapshot: PresenceSnapshot) => void): () => void;
  snapshot(): PresenceSnapshot;
  destroy(): void;
}
```

Then change the one line in [`src/hooks/usePresence.ts`](src/hooks/usePresence.ts)
that constructs it:

```ts
function createProvider(): PresenceProvider {
  return new LocalPresenceAdapter();
}
```

No component needs to change. Any hosted realtime service with presence or
pub/sub will do — this is a deliberately ordinary requirement and nothing in the
codebase assumes a particular vendor. Keep the same ~60–90s expiry window so
behaviour does not change, keep storing only the fields in `PresenceSession`
(anonymous id, activity, drink, channel, last seen), and keep stamping
`lastSeen` with the receiving client's clock rather than trusting the sender's.

### Looking at a busy room

Three browser tabs is not enough to judge a presence line, a count or the Room
pulse breakdown. In development:

```
http://localhost:3000/?simulate=300
```

fills the room with 300 invented sessions — a realistic spread of activities and
drinks, including people who shared nothing — and adds arrivals faster than
departures so the count climbs while you watch.

**Everything it shows is fake**, which is why it is fenced off three ways:

- the switch returns `null` whenever `NODE_ENV` is `production`, checked before
  anything else, so a visitor cannot turn it on — verified against a real
  `next build`, where `?simulate=300` produces no marker and no count. (The
  adapter is still in the bundle; it is unreachable, not absent.);
- it must be asked for by URL, never on by default;
- while it runs, the room carries a label saying so, so no screenshot of a busy
  room can be mistaken for a real one.

It implements the same `PresenceProvider` interface as the real adapter, so what
you are looking at is exactly what the components would do with real people in
the room. If you ever want to remove those guards, read the rule in `CLAUDE.md`
first — they are the only thing separating a design tool from a fake counter.

Two things to preserve when you do:

- The privacy threshold. The Room pulse breakdown is withheld below three people
  (`MIN_GROUP_FOR_BREAKDOWN`), because "1 reading · 1 tea" describes a person
  rather than a room.
- The honesty rule. A count is rendered only when it came from sessions actually
  heard from. There is no seeding, no minimum, and no fallback figure.

---

## Accessibility

- Every interactive element is a real semantic control, keyboard operable, with
  a visible focus ring. Covered by a Playwright test that walks the tab cycle and
  asserts a non-zero outline on each stop.
- Panels are non-modal disclosures. Escape closes and returns focus to the
  trigger; Tab moves through and out rather than being trapped.
- The channel explanations open on hover, on focus **and** on tap. Panels that
  are disclosures rather than tooltips (the timer, the Room pulse) deliberately
  do *not* open on focus, so tabbing past them does not pop them open.
- `prefers-reduced-motion` disables the background drift and collapses every
  transition, and the room stays fully usable without any motion. Both are
  covered by Playwright tests.
- Contrast is measured, not estimated. `npm run contrast` resolves each text
  element's colour, hides the text, screenshots what is actually behind it, and
  compares against the **lightest pixel** in the text's own line boxes. All 81
  text elements across five states pass AA, the tightest at 5.19:1.
- Controls dim after 8s idle and return instantly on any input — but never while
  a control is showing a keyboard focus ring.
- 44px minimum touch targets; works from 320px up; the room never scrolls on
  either axis.
```
