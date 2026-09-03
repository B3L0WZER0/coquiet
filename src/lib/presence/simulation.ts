/** The switch that fills the room with invented people. */

/** Above this the breakdown stops being a design question and starts being a stress test. */
const MAX = 5000;

export function simulatedRoomSize(): number | null {
  // Compiled out of production entirely: there is no build in which a visitor
  // can turn this on.
  if (process.env.NODE_ENV === 'production') return null;
  if (typeof window === 'undefined') return null;

  const raw = new URLSearchParams(window.location.search).get('simulate');
  if (raw === null) return null;

  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(n, MAX);
}
