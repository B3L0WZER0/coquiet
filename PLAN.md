# Coquiet — build plan

Run these milestones one at a time, in order, each as its own Claude Code session (or a fresh `/clear` within one). Each prompt below is meant to be pasted as-is. `CLAUDE.md` and `SPEC.md` should already be sitting in the repo root before you start M1 — Claude Code will read them automatically.

Don't start the next milestone until the current one is actually working and matches its listed acceptance criteria (numbers refer to the list in `SPEC.md`).

---

## Option: one prompt for the whole build

If you'd rather not paste five separate prompts, use this single one instead. It tells Claude Code to work through all five milestones itself, checkpointing against SPEC.md as it goes, so you only have to start it once.

Trade-off worth knowing: you won't see anything until Claude Code stops on its own (blocked, done, or genuinely unsure about something), so you lose the natural checkpoint to react to the visual direction after milestone 1 before it builds on top of it. If you'd like that checkpoint, just interrupt after milestone 1 looks right and tell it to continue — otherwise let it run.

**Paste into Claude Code:**

> Read CLAUDE.md, SPEC.md, and PLAN.md before doing anything else. Build the whole Coquiet MVP in this session, working through the five milestones in PLAN.md in order: foundation & atmosphere, audio engine, focus timer & notes, local presence & personal settings, then accessibility/performance/tests/docs. For each milestone, build it, then check it against the acceptance criteria SPEC.md lists for that milestone before moving to the next. Give me a short progress note after each milestone — what you built, what to look at — but don't stop and wait for my go-ahead unless something is genuinely ambiguous, blocked, or needs a product decision that isn't covered in SPEC.md or CLAUDE.md; in that case, ask, then continue. Follow every non-negotiable in CLAUDE.md throughout, not just at the end — no audio before "Enter the room," no fabricated presence numbers, nothing from the Non-goals list in SPEC.md, full keyboard accessibility, and prefers-reduced-motion support built in from the start. When all five milestones are done, check the full 20-item acceptance criteria list in SPEC.md once more, note #12's known v1 scope limit, write the README described in milestone 5, and tell me how to run it locally.

---

## Or: five milestones, one at a time

The original sequence, if you'd rather review after each step.

## M1 — Foundation & atmosphere

Scaffold the project and get the calm, static room feeling right before anything moves or makes sound.

**Paste into Claude Code:**

> Read CLAUDE.md and SPEC.md. Build milestone 1 only: project scaffold (Next.js + TypeScript + Tailwind), the full-screen background treatment using the images in /design-reference/, the wordmark, the pre-entry composition with the "Enter the room" button, and the responsive desktop/mobile layout skeleton with all control positions present but non-functional (music selector, timer, presence line, personal presence — visually placed, no logic yet). Respect prefers-reduced-motion. Don't build audio, timer, or presence logic yet. When done, tell me how to run it locally and which acceptance criteria (1, 16, 18, 19) I should check.

## M2 — Audio engine

The real core of the product: channels, crossfade, playback.

**Paste into Claude Code:**

> Read CLAUDE.md and SPEC.md. Build milestone 2: the audio engine. Wire /public/audio/placeholder.mp3 to all three channels via the per-channel config described in SPEC.md. Implement the client-side shared-station position calculation (no backend), play/pause with ~1s fade, ~4s entry fade-in, ~2-3s channel crossfade with no doubled audio, the music selector UI (Still/Flow/Momentum, Flow default, translucent active/inactive states), the info popover reachable by hover/focus/tap, and the volume control. Persist channel and volume in localStorage. When done, tell me how to verify acceptance criteria 2-8.

## M3 — Focus timer & focus notes

**Paste into Claude Code:**

> Read CLAUDE.md and SPEC.md. Build milestone 3: the focus timer (50/10 default, 25/5, 90/15, custom; start/pause/resume/reset popover; target-timestamp based so it survives backgrounding, sleep, and refresh; two-tone chime; notification permission requested only on deliberate start) and the break experience (lowering music, break copy, rotating suggestion, "Welcome back" / "Begin again"). Also implement the focus notes: deterministic per-global-hour selection, shown on entry/new session/hour boundary, fading after ~10s. When done, tell me how to verify acceptance criteria 9-11.

## M4 — Local presence & personal settings

**Paste into Claude Code:**

> Read CLAUDE.md and SPEC.md. Build milestone 4: the PresenceProvider interface and its local BroadcastChannel adapter, the bottom-left presence line with honest copy for the zero-and-one-tab cases, the Room pulse popover with small-group suppression, and the personal presence control (I'm.../With... picker, collapsing to "Working · Coffee" style summary, clearable anytime) with the custom line illustrations. Test by opening two tabs. When done, tell me how to verify acceptance criteria 12-15 (note #12 is same-browser-only in v1, per SPEC.md).

## M5 — Accessibility, performance, tests & docs

**Paste into Claude Code:**

> Read CLAUDE.md and SPEC.md. Do a full pass: keyboard accessibility and visible focus states on every control, ARIA labels/expanded states, WCAG AA contrast check over the background image, control auto-dim after ~8s idle with instant return on input, performance pass (responsive AVIF/WebP background, no layout shift, no premature audio preload), and remove anything decorative that doesn't do anything. Then write the Vitest tests for timer accuracy, audio/channel state, and presence expiry, plus Playwright tests for the critical entry → play → switch channel → start timer flow. Finish with a README (setup, no external service required, how to replace the background/audio assets, the music-licensing note) and confirm all 20 acceptance criteria in SPEC.md, noting #12's v1 scope limit.

---

## Later (not now): adding real cross-device presence

When you're ready to make presence work across different visitors' devices (not just tabs in one browser), add a second `PresenceProvider` implementation — Supabase Realtime, Pusher, Ably, or PartyKit all work — behind the same interface from M4. None of the UI should need to change; only the adapter swaps. Worth revisiting once the rest of the product feels right, not before.
