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
 */
export function Wordmark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <span
      className={
        size === 'lg'
          ? 'block text-[3.5rem] leading-none font-medium tracking-[0.065em] sm:text-[5.375rem]'
          : 'block text-[1.875rem] leading-none font-light tracking-[0.08em]'
      }
      style={{ color: 'var(--text-primary)', textShadow: 'var(--shadow-legible)' }}
    >
      coquiet
    </span>
  );
}
