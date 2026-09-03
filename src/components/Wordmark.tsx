/**
 * The coquiet wordmark: restrained typography, never an illustrated symbol.
 *
 * The two sizes carry different weights, on purpose. The entry hero is medium:
 * light reads thin at that scale, and bold would announce the product rather
 * than settle it. The mark in the corner of the room is light, because its job
 * there is to name the place and then get out of the way — the same weight that
 * gives the hero presence makes a small corner mark shout.
 *
 * Tracking is shared, so it still reads as one mark at two sizes.
 *
 * The hero size keeps growing after the last breakpoint. Held at one value it
 * was set for a laptop, and on a large display the mark sat in the middle of
 * all that room looking like it had been shrunk — the window got bigger and
 * the composition did not. Above the breakpoint it now tracks the width, with
 * the clamp's floor holding the 86px it has always been there and a ceiling
 * stopping it at 120px, because past a point a bigger screen is just further
 * away and the mark should stop chasing it.
 *
 * The rate it grows at was the thing that had to come down. At 4vw the mark
 * cleared 130px on an ordinary maximised 1080p window and read as a banner
 * rather than a name — the whole composition looked like it had been zoomed.
 * At 2.5vw the floor now holds until about 1200px, which covers every laptop,
 * and the growth above that is a nudge rather than a rescale: 104px at 1920,
 * 120px at 2560. The same halving is applied to every other line on the entry
 * screen, so the composition still scales as one thing.
 *
 * The corner mark is deliberately left fixed. Its job is to name the place
 * quietly from the edge of the room, and that reads the same at any width.
 */
export function Wordmark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <span
      className={
        size === 'lg'
          ? 'block text-[3.5rem] leading-none font-medium tracking-[0.065em] sm:text-[clamp(5.375rem,calc(3.5rem_+_2.5vw),7.5rem)]'
          : 'block text-[1.875rem] leading-none font-light tracking-[0.08em]'
      }
      style={{ color: 'var(--text-primary)', textShadow: 'var(--shadow-legible)' }}
    >
      coquiet
    </span>
  );
}
