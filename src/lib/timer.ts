/** Focus timer logic. */

export type TimerPhase =
  /** Nothing running. */
  | 'idle'
  /** A focus stretch. */
  | 'focus'
  /** The break that follows a focus stretch. */
  | 'break'
  /** The break is over and the room is waiting to begin again. */
  | 'break-ended';

export interface TimerPreset {
  id: string;
  label: string;
  focusMinutes: number;
  breakMinutes: number;
}

/** Shortest first. */
export const PRESETS: readonly TimerPreset[] = [
  { id: '25-5', label: '25 / 5', focusMinutes: 25, breakMinutes: 5 },
  { id: '50-10', label: '50 / 10', focusMinutes: 50, breakMinutes: 10 },
  { id: '90-15', label: '90 / 15', focusMinutes: 90, breakMinutes: 15 },
];

export const DEFAULT_PRESET_ID = '50-10';
export const CUSTOM_PRESET_ID = 'custom';

/** Bounds for the custom preset, in minutes. */
export const CUSTOM_LIMITS = {
  focus: { min: 1, max: 180 },
  break: { min: 1, max: 60 },
} as const;

/** Snap a typed number of minutes into range. */
export function clampMinutes(value: number, bounds: { min: number; max: number }): number {
  return clamp(value, bounds.min, bounds.max);
}

export interface TimerSession {
  phase: TimerPhase;
  presetId: string;
  focusMs: number;
  breakMs: number;
  /** When the current phase ends. */
  endsAt: number | null;
  /** What is left when paused. */
  pausedRemainingMs: number | null;
  /** How many breaks have started, used to rotate the break suggestion. */
  breakCount: number;
}

export type TimerEvent = 'focus-ended' | 'break-ended';

const MINUTE = 60_000;

export function presetById(id: string): TimerPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function createSession(presetId: string = DEFAULT_PRESET_ID): TimerSession {
  // Falls back to the default, not to whichever preset happens to be listed
  // first — the list is ordered for the eye and can be reordered freely.
  const preset = presetById(presetId) ?? presetById(DEFAULT_PRESET_ID)!;
  return {
    phase: 'idle',
    presetId: preset.id,
    focusMs: preset.focusMinutes * MINUTE,
    breakMs: preset.breakMinutes * MINUTE,
    endsAt: null,
    pausedRemainingMs: null,
    breakCount: 0,
  };
}

/** Switch durations. */
export function withPreset(session: TimerSession, presetId: string): TimerSession {
  const preset = presetById(presetId);
  if (!preset) return session;
  return {
    ...createSession(preset.id),
    breakCount: session.breakCount,
  };
}

/** Switch to custom durations, clamped to something a room can sensibly hold. */
export function withCustom(
  session: TimerSession,
  focusMinutes: number,
  breakMinutes: number,
): TimerSession {
  const focus = clamp(focusMinutes, CUSTOM_LIMITS.focus.min, CUSTOM_LIMITS.focus.max);
  const brk = clamp(breakMinutes, CUSTOM_LIMITS.break.min, CUSTOM_LIMITS.break.max);
  return {
    phase: 'idle',
    presetId: CUSTOM_PRESET_ID,
    focusMs: focus * MINUTE,
    breakMs: brk * MINUTE,
    endsAt: null,
    pausedRemainingMs: null,
    breakCount: session.breakCount,
  };
}

export function isRunning(session: TimerSession): boolean {
  return session.endsAt !== null;
}

export function isPaused(session: TimerSession): boolean {
  return session.pausedRemainingMs !== null;
}

/** Begin a focus stretch, from idle or from the end of a break. */
export function start(session: TimerSession, now: number = Date.now()): TimerSession {
  return {
    ...session,
    phase: 'focus',
    endsAt: now + session.focusMs,
    pausedRemainingMs: null,
  };
}

export function pause(session: TimerSession, now: number = Date.now()): TimerSession {
  if (session.endsAt === null) return session;
  return {
    ...session,
    endsAt: null,
    pausedRemainingMs: Math.max(0, session.endsAt - now),
  };
}

export function resume(session: TimerSession, now: number = Date.now()): TimerSession {
  if (session.pausedRemainingMs === null) return session;
  return {
    ...session,
    endsAt: now + session.pausedRemainingMs,
    pausedRemainingMs: null,
  };
}

export function reset(session: TimerSession): TimerSession {
  return {
    ...createSession(session.presetId),
    // A custom session keeps its durations rather than snapping back to a preset.
    focusMs: session.focusMs,
    breakMs: session.breakMs,
    presetId: session.presetId,
    breakCount: session.breakCount,
  };
}

/** Milliseconds left in the current phase. */
export function remainingMs(session: TimerSession, now: number = Date.now()): number {
  if (session.pausedRemainingMs !== null) return session.pausedRemainingMs;
  if (session.endsAt === null) {
    // Nothing is running, so the readout shows what pressing start would begin.
    // That includes the moment after a break: "Start 0:00" would read as a
    // broken clock rather than as an invitation.
    return session.phase === 'break' ? 0 : session.focusMs;
  }
  return Math.max(0, session.endsAt - now);
}

/** Move the session forward to wherever the clock says it should be. */
export function tick(
  session: TimerSession,
  now: number = Date.now(),
): { session: TimerSession; events: TimerEvent[] } {
  const events: TimerEvent[] = [];
  let next = session;

  // At most one focus and one break can complete per phase pair; the guard is
  // only there so a corrupt session can never spin.
  for (let i = 0; i < 4; i++) {
    if (next.endsAt === null || now < next.endsAt) break;

    if (next.phase === 'focus') {
      events.push('focus-ended');
      next = {
        ...next,
        phase: 'break',
        // Chain from the moment the focus actually ended, not from now, so a
        // late tick does not extend the break.
        endsAt: next.endsAt + next.breakMs,
        breakCount: next.breakCount + 1,
      };
      continue;
    }

    if (next.phase === 'break') {
      events.push('break-ended');
      next = { ...next, phase: 'break-ended', endsAt: null };
      continue;
    }

    break;
  }

  return { session: next, events };
}

/** "50:00". */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** The word beside the readout. */
export function phaseLabel(session: TimerSession): string {
  switch (session.phase) {
    case 'focus':
      return isPaused(session) ? 'Paused' : 'Focus';
    case 'break':
      return isPaused(session) ? 'Paused' : 'Break';
    default:
      return 'Start';
  }
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v)));
}
