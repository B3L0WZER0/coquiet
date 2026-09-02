/**
 * The timer chime.
 *
 * Two soft sine tones a fifth apart, the second entering under the tail of the
 * first, each with a slow attack and a long exponential decay. Synthesised
 * rather than loaded, so it costs nothing to ship and can never be the thing
 * that fails to download at the end of a focus stretch.
 *
 * Deliberately unhurried: this marks the end of a stretch of work, it is not an
 * alarm. It does still have to be *heard* over the music, which is the level
 * `PEAK` is set for.
 */

const TONES = [
  { frequency: 528, startAt: 0, duration: 3.0 },
  { frequency: 792, startAt: 0.55, duration: 3.4 },
] as const;

/**
 * Peak gain per tone.
 *
 * The chime plays over music sitting at the visitor's chosen level, and the
 * break duck only reaches full depth a second and a half later — so a chime
 * mixed to sit politely underneath is a chime nobody notices. This is loud
 * enough to arrive, and its slow attack and long decay are what keep it gentle.
 */
const PEAK = 0.3;

let context: AudioContext | null = null;

function audioContextClass(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

/**
 * Create the audio context and get it running, from inside a user gesture.
 *
 * This is the whole reason the chime is reliable. A context first created when
 * the timer fires is created outside any gesture, and browsers are entitled to
 * hand it back suspended and to refuse to resume it — which produces a timer
 * that ends in total silence. Building it while the visitor's press on Start is
 * still on the stack means it is already running when it is needed.
 *
 * Safe to call repeatedly.
 */
export async function primeChime(): Promise<void> {
  const Ctor = audioContextClass();
  if (!Ctor) return;
  try {
    context ??= new Ctor();
    if (context.state === 'suspended') await context.resume();
  } catch {
    // Nothing to recover from: the timer works either way, it is only the
    // sound at the end that would be missing.
  }
}

/**
 * Play the chime.
 *
 * Safe to call when audio is unavailable or the context is blocked — it simply
 * does nothing rather than throwing into the timer's completion path.
 */
export async function playChime(): Promise<void> {
  await primeChime();
  const ctx = context;
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
