'use client';

/**
 * Shown when the music could not be loaded at all.
 *
 * Until this existed the room simply stayed quiet: the engine set its `error`
 * status and nothing read it, so a visitor whose network refuses the audio
 * origin — a filtered office connection is the common one — saw a play control
 * that did nothing and had no way to tell that from a fault of their own.
 *
 * It stands where the focus note does and is set like it — cream on a pool of
 * shade is the one combination over these photographs known to hold its
 * contrast — but the pool is its own, and deeper. See `.room-sound`.
 */
export function SoundUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="room-sound flex items-center justify-center">
      <div aria-hidden="true" className="room-sound-veil pointer-events-none" />

      {/* Polite: the room is not broken and nothing is waiting on a reply. */}
      <div role="status" className="flex max-w-[30ch] flex-col items-center gap-3 text-center">
        <p
          className="text-[1.375rem] leading-snug font-light tracking-[0.015em] text-balance sm:text-[1.75rem]"
          style={{
            color: 'var(--color-cream)',
            textShadow: '0 1px 24px color-mix(in oklab, var(--color-ink) 78%, transparent)',
          }}
        >
          The music won’t load here.
        </p>

        {/* Says where to look without asserting it as the cause — we cannot see
            their network, and a wrong diagnosis is worse than a hint. */}
        <p
          className="text-[0.9375rem] leading-relaxed font-light text-balance"
          style={{
            color: 'var(--text-secondary)',
            textShadow: '0 1px 20px color-mix(in oklab, var(--color-ink) 78%, transparent)',
          }}
        >
          Networks at work and school often block where it is hosted. The timer and the
          room still work without it.
        </p>

        <button type="button" onClick={onRetry} className="room-retry mt-1 text-[0.9375rem] font-light">
          Try again
        </button>
      </div>
    </div>
  );
}
