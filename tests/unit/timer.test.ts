import { describe, expect, it } from 'vitest';

import {
  CUSTOM_LIMITS,
  DEFAULT_PRESET_ID,
  PRESETS,
  clampMinutes,
  createSession,
  formatRemaining,
  isPaused,
  isRunning,
  pause,
  phaseLabel,
  remainingMs,
  reset,
  resume,
  start,
  tick,
  withCustom,
  withPreset,
} from '@/lib/timer';

const MINUTE = 60_000;
/** An arbitrary fixed "now", so nothing in these tests depends on the clock. */
const T0 = 1_700_000_000_000;

describe('timer defaults', () => {
  it('starts idle at 50/10', () => {
    const s = createSession();
    expect(s.phase).toBe('idle');
    expect(s.presetId).toBe(DEFAULT_PRESET_ID);
    expect(s.focusMs).toBe(50 * MINUTE);
    expect(s.breakMs).toBe(10 * MINUTE);
    expect(isRunning(s)).toBe(false);
  });

  it('shows the full focus length before starting', () => {
    expect(formatRemaining(remainingMs(createSession(), T0))).toBe('50:00');
  });
});

describe('accuracy against the clock', () => {
  it('counts down from the end timestamp, not from ticks', () => {
    const s = start(createSession(), T0);
    expect(remainingMs(s, T0)).toBe(50 * MINUTE);
    expect(remainingMs(s, T0 + 60_000)).toBe(49 * MINUTE);
    expect(formatRemaining(remainingMs(s, T0 + 90_000))).toBe('48:30');
  });

  it('is unaffected by how long the page was asleep', () => {
    const s = start(createSession(), T0);
    // No ticks at all for twenty minutes, then one look at the clock.
    const after = tick(s, T0 + 20 * MINUTE);
    expect(after.events).toEqual([]);
    expect(formatRemaining(remainingMs(after.session, T0 + 20 * MINUTE))).toBe('30:00');
  });

  it('never reports negative time', () => {
    const s = start(createSession(), T0);
    expect(remainingMs(s, T0 + 999 * MINUTE)).toBe(0);
  });
});

describe('phase transitions', () => {
  it('moves into the break when the focus stretch ends', () => {
    const s = start(createSession(), T0);
    const { session, events } = tick(s, T0 + 50 * MINUTE);
    expect(events).toEqual(['focus-ended']);
    expect(session.phase).toBe('break');
    expect(session.breakCount).toBe(1);
    expect(remainingMs(session, T0 + 50 * MINUTE)).toBe(10 * MINUTE);
  });

  it('chains the break from when focus actually ended, not from the late tick', () => {
    const s = start(createSession(), T0);
    // The tab was asleep and only looked four minutes after focus ended, so
    // six minutes of break should remain — not a fresh ten.
    const { session } = tick(s, T0 + 54 * MINUTE);
    expect(session.phase).toBe('break');
    expect(remainingMs(session, T0 + 54 * MINUTE)).toBe(6 * MINUTE);
  });

  it('resolves a sleep spanning both phases in a single tick', () => {
    const s = start(createSession(), T0);
    const { session, events } = tick(s, T0 + 61 * MINUTE);
    expect(events).toEqual(['focus-ended', 'break-ended']);
    expect(session.phase).toBe('break-ended');
    expect(isRunning(session)).toBe(false);
  });

  it('emits nothing when nothing has elapsed', () => {
    const s = start(createSession(), T0);
    const { session, events } = tick(s, T0 + 1000);
    expect(events).toEqual([]);
    expect(session).toBe(s);
  });
});

describe('pause and resume', () => {
  it('keeps the remaining time across a pause of any length', () => {
    const started = start(createSession(), T0);
    const paused = pause(started, T0 + 10 * MINUTE);
    expect(isPaused(paused)).toBe(true);
    expect(isRunning(paused)).toBe(false);
    expect(remainingMs(paused, T0 + 10 * MINUTE)).toBe(40 * MINUTE);
    // Time passing while paused must not consume the session.
    expect(remainingMs(paused, T0 + 90 * MINUTE)).toBe(40 * MINUTE);

    const resumed = resume(paused, T0 + 90 * MINUTE);
    expect(isRunning(resumed)).toBe(true);
    expect(remainingMs(resumed, T0 + 90 * MINUTE)).toBe(40 * MINUTE);
    expect(remainingMs(resumed, T0 + 95 * MINUTE)).toBe(35 * MINUTE);
  });

  it('does not fire a transition while paused', () => {
    const paused = pause(start(createSession(), T0), T0 + MINUTE);
    expect(tick(paused, T0 + 900 * MINUTE).events).toEqual([]);
  });

  it('labels a paused session as paused', () => {
    expect(phaseLabel(pause(start(createSession(), T0), T0))).toBe('Paused');
    expect(phaseLabel(start(createSession(), T0))).toBe('Focus');
    expect(phaseLabel(createSession())).toBe('Start');
  });
});

describe('presets', () => {
  it('switches durations and returns to idle', () => {
    const running = start(createSession(), T0);
    const next = withPreset(running, '90-15');
    expect(next.phase).toBe('idle');
    expect(next.focusMs).toBe(90 * MINUTE);
    expect(next.breakMs).toBe(15 * MINUTE);
  });

  it('ignores an unknown preset rather than breaking', () => {
    const s = createSession();
    expect(withPreset(s, 'nonsense')).toBe(s);
  });

  it('accepts a one-minute focus stretch', () => {
    // The floor used to be five, which silently rewrote a requested 1/10 as
    // 5/10 — the field said one thing and the timer ran another.
    const short = withCustom(createSession(), 1, 10);
    expect(short.focusMs).toBe(1 * MINUTE);
    expect(short.breakMs).toBe(10 * MINUTE);
    expect(formatRemaining(remainingMs(short, T0))).toBe('1:00');
  });

  it('clamps custom durations into a sensible range', () => {
    const tooLong = withCustom(createSession(), 9999, 9999);
    expect(tooLong.focusMs).toBe(CUSTOM_LIMITS.focus.max * MINUTE);
    expect(tooLong.breakMs).toBe(CUSTOM_LIMITS.break.max * MINUTE);

    const tooShort = withCustom(createSession(), 0, 0);
    expect(tooShort.focusMs).toBe(CUSTOM_LIMITS.focus.min * MINUTE);
    expect(tooShort.breakMs).toBe(CUSTOM_LIMITS.break.min * MINUTE);

    expect(withCustom(createSession(), Number.NaN, 5).focusMs).toBe(
      CUSTOM_LIMITS.focus.min * MINUTE,
    );
  });

  it('reset keeps custom durations rather than snapping to a preset', () => {
    const custom = start(withCustom(createSession(), 20, 3), T0);
    const back = reset(custom);
    expect(back.phase).toBe('idle');
    expect(back.focusMs).toBe(20 * MINUTE);
    expect(back.breakMs).toBe(3 * MINUTE);
  });
});

describe('clampMinutes', () => {
  it('is the same rule the input uses to correct itself', () => {
    expect(clampMinutes(1, CUSTOM_LIMITS.focus)).toBe(1);
    expect(clampMinutes(0, CUSTOM_LIMITS.focus)).toBe(CUSTOM_LIMITS.focus.min);
    expect(clampMinutes(999, CUSTOM_LIMITS.focus)).toBe(CUSTOM_LIMITS.focus.max);
    expect(clampMinutes(7.4, CUSTOM_LIMITS.focus)).toBe(7);
    expect(clampMinutes(Number.NaN, CUSTOM_LIMITS.focus)).toBe(CUSTOM_LIMITS.focus.min);
  });

  it('agrees with what withCustom stores, so the field cannot drift', () => {
    for (const typed of [0, 1, 7, 50, 180, 999]) {
      const clamped = clampMinutes(typed, CUSTOM_LIMITS.focus);
      expect(withCustom(createSession(), typed, 10).focusMs).toBe(clamped * MINUTE);
    }
  });
});

describe('the idle readout', () => {
  it('invites a start rather than reporting readiness', () => {
    expect(phaseLabel(createSession())).toBe('Start');
    const { session: afterBreak } = tick(start(createSession(), T0), T0 + 61 * MINUTE);
    expect(afterBreak.phase).toBe('break-ended');
    expect(phaseLabel(afterBreak)).toBe('Start');
  });

  it('shows the length of the session that start would begin', () => {
    // Not 0:00, which alongside "Start" reads as a broken clock.
    const { session: afterBreak } = tick(start(createSession(), T0), T0 + 61 * MINUTE);
    expect(formatRemaining(remainingMs(afterBreak, T0 + 61 * MINUTE))).toBe('50:00');
    expect(formatRemaining(remainingMs(createSession(), T0))).toBe('50:00');
  });
});

describe('formatting', () => {
  it('rounds up so a running timer never reads 0:00', () => {
    expect(formatRemaining(1)).toBe('0:01');
    expect(formatRemaining(0)).toBe('0:00');
    expect(formatRemaining(59_400)).toBe('1:00');
  });

  it('shows hours only when there are hours', () => {
    expect(formatRemaining(50 * MINUTE)).toBe('50:00');
    expect(formatRemaining(90 * MINUTE)).toBe('1:30:00');
  });
});


describe('preset ordering', () => {
  it('lists them shortest first', () => {
    const minutes = PRESETS.map((p) => p.focusMinutes);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    expect(minutes).toEqual([25, 50, 90]);
  });

  it('defaults to 50/10 regardless of what the list starts with', () => {
    // The order is for the eye; the default must not follow it.
    expect(PRESETS[0].id).not.toBe(DEFAULT_PRESET_ID);
    expect(createSession().focusMs).toBe(50 * MINUTE);
    // An unrecognised id falls back to the default, not to the first entry.
    expect(createSession('nonsense').focusMs).toBe(50 * MINUTE);
  });
});
