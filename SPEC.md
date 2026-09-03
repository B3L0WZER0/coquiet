# Coquiet — product spec (v1)

Act as a senior product designer and full-stack engineer. Design and implement a polished, production-quality MVP for **Coquiet**, a minimal website where people quietly focus together while listening to synchronized instrumental music.

Build the working experience — responsive design, audio behavior, focus timer, and locally-synced anonymous presence — not a description of one.

Core promise: **Quiet company for focused work.**

Coquiet should feel like entering a beautiful, calm room where other people are also concentrating — without cameras, chat, or social pressure. Not a productivity dashboard, not a social network, not a generic lo-fi player.

## Product priorities, in order

1. Immediate calm and visual atmosphere
2. Effortless entry into focus
3. A subtle feeling of human presence
4. Excellent, uninterrupted music playback
5. Useful but unobtrusive focus tools

Every interface element must earn its place.

## Brand

Lowercase wordmark: **coquiet**. Provisional domain: **coquiet.work**.

- Title: `coquiet — quiet company for focused work`
- Description: `Enter a beautiful shared room, choose your music and focus quietly alongside others.`

Logo is a restrained typographic wordmark, not an illustrated symbol.

## Visual direction

Reference images are provided in `/design-reference/` — use them as mood inspiration, not production assets to copy.

One coherent fictional architectural world:

- Monumental organic architecture; limestone, sandstone, travertine, soft plaster
- Warm wood, clay, restrained greenery
- Cream, oat, beige, taupe, tobacco, soft charcoal
- Large windows, arches, carved openings; diffused daylight, gentle shadows
- Generous negative space; quiet human scale inside a grand interior
- Optional distant human figure, never visually dominant
- Cinematic, editorial architectural photography; contemplative, premium, timeless

Avoid: generic office photography, neon/cyberpunk color, lo-fi anime imagery, cartoon cafés, bright SaaS gradients, heavy glassmorphism, busy fantasy interiors, unrelated rotating environments.

One excellent full-screen visual with careful responsive cropping. Subtle warm contrast veil so controls stay readable without flattening the image. Any background movement is nearly imperceptible (extremely slow drift or light change) and disabled under `prefers-reduced-motion`.

Typography: quiet, premium, understated sans-serif for the interface; optional restrained serif for focus notes.

## Overall layout

One immersive, full-viewport room, not a scrolling dashboard.

**Desktop composition (after entry):**

- Top left: `coquiet` wordmark
- Top center: music selector
- Top right: compact focus timer
- Center: transient focus note
- Bottom left: live room presence
- Bottom center: play/pause and volume
- Bottom right: optional personal presence

Translucent warm-toned controls, fine borders, restrained backdrop blur. Controls may dim after ~8s of inactivity but return immediately on pointer move, touch, or keyboard use. Keyboard focus is never hidden.

**Mobile:**

- Music stays near top center
- Presence and timer share a compact top row when needed
- Personal settings open in an accessible bottom sheet
- Play/pause stays bottom center
- Respect device safe areas; no overlapping controls; 44px minimum touch targets; works from 320px wide up

## Entry experience

Before entering, a quiet centered composition:

**coquiet** / **Quiet company for focused work.** / `[real number] people are here now.`

Primary button: **Enter the room**. Underneath: `Sound begins gently.`

No sound before deliberate interaction. On press:

1. Register the anonymous visitor as present (local adapter — see Presence)
2. Dissolve the entry layer
3. Load the default Flow channel
4. Begin at zero volume, fade in over ~4s
5. Reveal in-room controls
6. Briefly show the current focus note
7. No onboarding form

If presence sync is unavailable: `The quiet room is open.` If nobody else is present: `You're opening the room. Others will join.` Never fabricate a live number.

## Music selector

Upper-middle placement. Structure: `MUSIC ⓘ` / `Still Flow Momentum`. **Flow is selected by default.**

All three channel buttons stay translucent — active is more visible, never an opaque solid button:

- Inactive: low-opacity background, fine border, muted text
- Active: stronger translucent tint, brighter border, full-contrast text, subtle indicator
- No large color fill, no exaggerated glow, smooth 200–300ms transition

Small info icon beside `MUSIC`, working via hover, keyboard focus, and mobile tap, explaining:

- **Still** — Spacious piano, slow strings, very little rhythmic movement.
- **Flow** — Balanced chamber music for steady, sustained concentration.
- **Momentum** — Brighter strings and restrained rhythmic energy.

## Audio behavior

Instrumental, neoclassical, cinematic. `https://www.youtube.com/watch?v=dMYQh4ELrd0` is a mood reference only — never download, isolate, or restream its audio.

**v1 placeholder:** one licensed/owned file at `/public/audio/placeholder.mp3`, wired to all three channels via a small per-channel config object (`{ id, label, src, durationSeconds }`), so real distinct tracks can be swapped in per channel later with no logic changes.

### Shared-station behavior

Each channel behaves as a continuous shared station: everyone on the same channel hears roughly the same point in its program. **This does not require a backend.** Compute playback position client-side from a fixed reference epoch (a constant in the channel config) and the track's duration, using the visitor's own clock:

```
elapsed = (Date.now() - channel.epochMs) % (channel.durationSeconds * 1000)
```

Every visitor's device clock is close enough to real time for this to line up in practice; exact sample-level sync isn't needed. When someone pauses and resumes, rejoin at the freshly-computed position rather than continuing from an old local offset.

### Transitions

- Entry fade-in: ~4s
- Play/pause fade: ~1s
- Channel crossfade: ~2–3s
- Never cut audio abruptly; never leave two channels audibly overlapping after a transition
- Preserve the user's chosen base volume; no volume jumps during crossfades
- Use two managed audio elements or Web Audio gain nodes for reliable crossfades

Bottom center: refined circular play/pause button; discreet volume control that expands on hover/focus/tap; clear accessible labels. Remember channel and volume locally (`localStorage`). Don't preload full audio before entry — metadata/minimal buffering only.

## Focus notes

Short original notes, not clichés or misattributed quotes. Shown briefly after entering, briefly at the start of a new focus session, and at the start of each global hour — fading after ~8–10s. Same note for everyone during a given global hour, chosen deterministically from a local collection (no API needed). Example tone: *"One thing at a time." / "Stay with the work." / "Begin gently. Continue steadily."* Never permanently visible.

## Focus timer

Small, secondary, upper-right. Default 25/5 (focus/break); presets 50/10, 90/15, and Custom. Popover: Start, Pause, Resume, Reset, preset selection.

- Uses target timestamps, not interval ticks alone — accurate in background tabs and after device sleep
- Restores an active session after refresh; persists locally
- Gentle two-tone chime, never a harsh alarm
- Requests notification permission only after the user deliberately starts a timer

### Break experience

On focus end: play the chime, lower (don't stop) the music, transition into the break duration, show **Take ten. The room will be here.** with one rotating suggestion (*"Look at something far away." / "Stretch your hands and shoulders." / "Make a tea."* etc.). At break end: **Welcome back.** / **Begin again**, restoring normal music level smoothly when the next session starts.

## Presence implementation (v1)

No Supabase or other external realtime service in this version. Build a `PresenceProvider` interface with one working implementation: a **local adapter** using `BroadcastChannel` to sync anonymous session state across tabs in the same browser. Expiry window ~60–90s after a tab stops sending heartbeats, same as the eventual production behavior — just scoped to one browser for now.

Store only, per session: anonymous session id, current activity, current drink, selected music channel, last heartbeat. No names, emails, precise location, or history.

Keep this behind the interface so a real cross-device backend (Supabase Realtime, Pusher, PartyKit, etc.) can be added later as a second implementation with zero UI changes.

## Quiet presence (display)

Bottom left, one persistent line: `● [n] here now` — real count of currently-entered sessions from the active adapter (local adapter in v1), never raw page views, never fabricated.

Tap/click opens a compact **Room pulse** panel: `[n] working · [n] studying · [n] creating · [n] reading` and `[n] coffee · [n] tea · [n] water`. If groups are extremely small, suppress the detailed breakdown for privacy. No flags, maps, rankings, or identities.

## Personal presence

Optional bottom-right control, never blocking entry: **Set your presence** → **I'm...** (Working / Studying / Reading / Creating) with **...and** (Coffee / Tea / Water / Nothing). Once selected, collapses to e.g. `Working · Coffee`. Changeable or clearable anytime. Restrained custom line illustrations for coffee/tea/water in clay, charcoal, cream — no emoji or cartoon art.

## Interaction and accessibility

Semantic HTML controls; visible keyboard focus; every tooltip reachable by keyboard and touch; ARIA labels and expanded states; WCAG AA contrast over every background crop; `prefers-reduced-motion` respected; no constant decorative animation; no scrollbars in the primary desktop view; no layout shift; calm loading state; graceful offline states for audio and presence; no aggressive toasts; no incorrect focus trapping; interface stays complete when activity/drink are never selected.

## Performance

Responsive AVIF/WebP background; preload only the initial visual; no full audio preload before entry; load only the active channel initially, prepare the incoming channel just before a crossfade; no leaked audio elements after switching; avoid heavy animation libraries where CSS suffices; usable first interface on slower mobile connections; stable media dimensions.

## Explicit non-goals

No chat, comments, DMs, video/voice, profiles, accounts, avatars, followers, public user lists, flags/maps, likes/reactions, productivity scores, streaks/badges/leaderboards, task management, user-created rooms or playlists, track voting/requests, cooking/gaming modes, large analytics dashboards, lyrics/spoken-word music, in-room advertising, or fake presence numbers. One global room, one shared presence count, three music channels.

## Acceptance criteria

1. Feels like a premium, calm architectural space, not a dashboard.
2. No audio before **Enter the room** is pressed.
3. Entry starts Flow with a smooth fade-in.
4. Flow is clearly active while its button stays translucent.
5. Still/Flow/Momentum explanations reachable by hover, focus, and tap.
6. Channel switching crossfades cleanly — no silence, volume jump, or doubled audio.
7. Play/pause fades audio rather than cutting it.
8. Resuming rejoins the current computed shared position.
9. Focus notes rotate without reload and fade after ~10s.
10. Timer stays accurate through backgrounding, sleep, and refresh.
11. Timer completion produces the chime and calm break flow.
12. Presence updates in real time between simultaneous tabs in the same browser (v1 scope — see note below).
13. Disconnected/stale sessions disappear automatically.
14. Activity/drink selections update aggregate counts without identifying anyone.
15. No fabricated count ever appears, including when the local adapter has only one tab open.
16. Layout stays uncluttered from 320px through large desktop.
17. Every interactive element is keyboard accessible.
18. Reduced-motion mode disables unnecessary movement.
19. Media causes no layout shift.
20. No decorative controls that do nothing.

**Known v1 scope note on #12:** presence syncs live across tabs in one browser, not yet across different visitors' devices — that requires a real backend, deliberately deferred (see `CLAUDE.md`).

## Deliverables

- Complete working implementation, responsive desktop and mobile
- Concise setup instructions (no external service required to run v1)
- Replaceable configuration for music sources (per-channel `src`/`epochMs`/`durationSeconds`)
- Replaceable focus notes and break suggestions
- Short music-licensing note documenting the placeholder track's status
- Focused tests: timer accuracy, audio/channel state, presence expiry (against the local adapter)
- Instructions for replacing the background image and audio assets
- A short note on how to add a real presence backend later behind `PresenceProvider`, without naming a specific vendor as a requirement
