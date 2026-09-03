'use client';

/** The transient focus note in the middle of the room. */
export function FocusNote({
  text,
  visible,
}: {
  text: string | null;
  visible: boolean;
}) {
  const shown = visible && !!text;

  return (
    <div className="pointer-events-none flex items-center justify-center">
      {/* The pool of shade spans the room, not a box drawn round the text. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 transition-opacity duration-[1200ms] ease-[var(--ease-quiet)]"
        style={{
          opacity: shown ? 1 : 0,
          background:
            'radial-gradient(46% 34% at 50% 50%, color-mix(in oklab, var(--color-ink) 74%, transparent) 0%, color-mix(in oklab, var(--color-ink) 64%, transparent) 26%, color-mix(in oklab, var(--color-ink) 44%, transparent) 48%, color-mix(in oklab, var(--color-ink) 22%, transparent) 68%, color-mix(in oklab, var(--color-ink) 7%, transparent) 85%, transparent 100%)',
        }}
      />

      <p
        // Same family as everything else. The note is set apart by size,
        // weight and air rather than by a change of typeface.
        className="max-w-[24ch] text-center text-[1.375rem] leading-snug font-light tracking-[0.015em] text-balance transition-opacity duration-[1200ms] ease-[var(--ease-quiet)] sm:max-w-[32ch] sm:text-[1.75rem]"
        style={{
          color: 'var(--color-cream)',
          textShadow:
            '0 1px 24px color-mix(in oklab, var(--color-ink) 78%, transparent)',
          opacity: shown ? 1 : 0,
        }}
        aria-hidden={!shown}
      >
        {text}
      </p>
    </div>
  );
}
