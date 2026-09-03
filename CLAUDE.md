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
