# Coquiet — project guide for Claude Code

**Quiet company for focused work.** One shared focus room: synchronized instrumental music, a focus timer, and light anonymous presence. No dashboards, no social features, no accounts.

Full product detail lives in `SPEC.md`. The build order lives in `PLAN.md`. Read both before starting, but only build the milestone you've been asked for.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Vitest for logic tests, Playwright for interaction tests
- No external backend in v1 (see Presence below)

## Non-negotiables (apply in every milestone)

- No audio plays before the user deliberately presses "Enter the room."
- Never show a fabricated presence number to a visitor. Numbers a visitor can see must come from sessions actually heard from — no seeding, no minimum, no fallback figure.
- Invented presence is allowed in one place only: the **simulated room**, a development tool for looking at the interface at a size real testing cannot reach. Three things must stay true of it, or it has become the thing the rule above forbids:
  1. `simulatedRoomSize()` returns `null` whenever `NODE_ENV` is `production`, checked before anything else, so a visitor cannot switch it on. (The code is still in the bundle — it is unreachable, not absent.)
  2. It has to be asked for explicitly, with `?simulate=300`. Never on by default.
  3. While it runs, the room says so on screen, so no screenshot of a busy room can be passed off as a real one.
- Don't add anything from the Non-goals list in `SPEC.md` — no accounts, avatars, chat, streaks, dashboards, etc. — even if it seems like a natural extension.
- Respect `prefers-reduced-motion` everywhere motion appears.
- Every interactive element is keyboard operable with a visible focus state.
- No layout shift from images or audio loading.

## Assets (drop these in before running Claude Code)

- Reference images → `/design-reference/` — mood and tone only, never copy them literally into the UI.
- Placeholder soundtrack → `/public/audio/placeholder.mp3` — one real file for now. Wire it to all three channels (Still / Flow / Momentum) so the channel-switching UI and crossfade logic are fully real, even though the audio content is identical across channels until final tracks exist. Keep the three channel entries in one small config object so swapping in real files later is a one-line change per channel, not a refactor.

## Presence (v1) — no Supabase, no external service

Build presence behind a `PresenceProvider` interface with exactly one implementation for now: a **local adapter** using the browser's `BroadcastChannel` API to sync state across tabs open in the same browser. This gives real, honest multi-tab presence (open two tabs, watch the count and pulse panel update) with zero backend setup.

- In this adapter, "people here now" reflects real open tabs — never a fabricated or hardcoded number.
- If only one tab is open, say so honestly rather than implying company.
- The entry screen *observes* the room without joining it, so it can report how many people are already working without counting someone who is still reading the front door.
- Keep the interface generic enough that a real multi-device backend (Supabase Realtime, Pusher, PartyKit, or similar) can be dropped in later as a second implementation without touching any UI code. Don't build that second implementation now — just don't paint the UI into a corner that assumes only one adapter will ever exist.

## Working style

Build and verify one milestone from `PLAN.md` at a time. Don't start the next milestone until the current one's relevant acceptance criteria (listed in `SPEC.md`) are actually met — show me what changed and how to check it before moving on.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
