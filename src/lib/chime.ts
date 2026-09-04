/** The timer chime. */

const TONES = [
  { frequency: 528, startAt: 0, duration: 3.0 },
  { frequency: 792, startAt: 0.55, duration: 3.4 },
] as const;

/** Peak gain per tone. */
const PEAK = 0.3;

/** How long the chime rings, so callers can time a duck around it. */
export const CHIME_DURATION_MS = Math.max(...TONES.map((t) => t.startAt + t.duration)) * 1000;

/** A context of the chime's own, for browsers where the room does not keep one. */
let ownContext: AudioContext | null = null;

/** The room's context, when it has one. Preferred on iOS: a context with no
 *  media element attached is silenced by the ring switch, and once the page has
 *  been backgrounded it suspends and cannot be resumed without a fresh gesture —
 *  which a timer ending is not. The room's context has the music flowing through
 *  it, so it stays running and audible. */
let sharedContext: (() => AudioContext | null) | null = null;

export function setChimeContextSource(source: () => AudioContext | null): void {
  sharedContext = source;
}

function currentContext(): AudioContext | null {
  return sharedContext?.() ?? ownContext;
}

function audioContextClass(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

/** Create the audio context and get it running, from inside a user gesture. */
export async function primeChime(): Promise<void> {
  try {
    // If the room already has a context, ride on it and open none of our own.
    const existing = sharedContext?.();
    if (existing) {
      if (existing.state === 'suspended') await existing.resume();
      return;
    }
    const Ctor = audioContextClass();
    if (!Ctor) return;
    ownContext ??= new Ctor();
    if (ownContext.state === 'suspended') await ownContext.resume();
  } catch {
    // Nothing to recover from: the timer works either way, it is only the
    // sound at the end that would be missing.
  }
}

/** Play the chime. */
export async function playChime(): Promise<void> {
  await primeChime();
  const ctx = currentContext();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;

  for (const tone of TONES) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = tone.frequency;

    const start = now + tone.startAt;
    const attack = 0.14;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(PEAK, start + attack);
    // Exponential decay to near-silence, then a hard zero so the node can be
    // torn down without a click.
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
    gain.gain.setValueAtTime(0, start + tone.duration + 0.01);

    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + tone.duration + 0.05);
    // Oscillators are single-use; releasing on end keeps nothing alive.
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}
