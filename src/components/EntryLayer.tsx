'use client';

import { Wordmark } from '@/components/Wordmark';
import { CoffeeMarkInline } from '@/components/icons/DrinkMarks';
import { LiveDot } from '@/components/ui/LiveDot';
import { SUPPORT_LABEL, SUPPORT_URL } from '@/lib/support';

/** The composition shown before the room is entered. */
export function EntryLayer({
  presenceLine,
  leaving,
  onEnter,
}: {
  presenceLine: string | null;
  /** True while the layer dissolves; it is removed from the DOM after. */
  leaving: boolean;
  onEnter: () => void;
}) {

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col items-center justify-center px-6 text-center transition-opacity duration-[900ms] ease-[var(--ease-quiet)]"
      style={{
        opacity: leaving ? 0 : 1,
        paddingTop: 'var(--inset-t)',
        paddingBottom: 'var(--inset-b)',
      }}
      // Once the layer starts dissolving it is no longer reachable; focus moves
      // into the room instead.
      inert={leaving ? true : undefined}
    >
      {/* The pool of shade spans the whole viewport rather than a box drawn round the text. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(66% 82% at 50% 50%, color-mix(in oklab, var(--color-ink) 84%, transparent) 0%, color-mix(in oklab, var(--color-ink) 76%, transparent) 16%, color-mix(in oklab, var(--color-ink) 58%, transparent) 31%, color-mix(in oklab, var(--color-ink) 36%, transparent) 46%, color-mix(in oklab, var(--color-ink) 18%, transparent) 61%, color-mix(in oklab, var(--color-ink) 6%, transparent) 79%, transparent 100%)',
        }}
      />

      {/* Two groups, read as two: the name and what it says, then — after a pause — the things you act on. */}
      <div
        className="relative flex flex-col items-center"
        style={{
          ['--entry-gap' as string]: 'clamp(2.5rem, 14vh, 7rem)',
          transform: 'translateY(calc((var(--entry-gap) - 2.5rem) / 2 - 1.25rem))',
        }}
      >
        <Wordmark size="lg" />

        {/* Sized well below the wordmark on purpose. */}
        <h1
          className="mt-5 text-[1.125rem] leading-snug font-normal sm:mt-[1.625rem] sm:text-[clamp(1.375rem,calc(1.125rem_+_0.5vw),2rem)]"
          style={{ color: 'var(--text-primary)', textShadow: 'var(--shadow-legible)' }}
        >
          Focus quietly, together
        </h1>

        <p
          // `text-balance` evens the lines out. At its natural measure the last
          // line held two words on its own, which read as the sentence having
          // been cut off rather than as a paragraph ending.
          className="mt-4 max-w-[32ch] text-[0.9375rem] leading-relaxed text-balance sm:mt-[1.125rem] sm:max-w-[46ch] sm:text-[clamp(1rem,calc(0.75rem_+_0.35vw),1.25rem)]"
          style={{ color: 'var(--text-secondary)', textShadow: 'var(--shadow-legible)' }}
        >
          Step into a shared room and work alongside other people. No chat, no cameras — just
          synchronised music and the quiet company of others concentrating.
        </p>

        {/* The slot is always here, at its full height, even before anyone has been heard from. */}
        <div className="flex min-h-9 items-center" style={{ marginTop: 'var(--entry-gap)' }}>
          <p
            className="control-surface flex min-h-9 items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] transition-opacity duration-[600ms] ease-[var(--ease-quiet)] sm:text-[clamp(0.8125rem,calc(0.625rem_+_0.2vw),1rem)]"
            style={{ color: 'var(--text-secondary)', opacity: presenceLine ? 1 : 0 }}
            // The count can change while the entry screen is open; announce it
            // quietly rather than interrupting.
            aria-live="polite"
            aria-hidden={presenceLine ? undefined : true}
          >
            <LiveDot />
            {presenceLine ?? 'Room open'}
          </p>
        </div>

        {/* Without a count to show there is one less step down to the button, so the gap opens up rather than leaving a hole. */}
        <button type="button" onClick={onEnter} className="coquiet-cta mt-[0.9375rem]">
          Enter the room
        </button>

        {/* Sits lowest, where the scrim is thinnest, and it promises an affordance — so it is the one small line that does not get to be the quietes... */}
        <p
          className="mt-[1.1875rem] text-[0.8125rem] sm:text-[clamp(0.8125rem,calc(0.625rem_+_0.2vw),1rem)]"
          style={{ color: 'var(--text-secondary)', textShadow: 'var(--shadow-legible)' }}
        >
          Ambient sound fades in · mute anytime.
        </p>
      </div>

      {SUPPORT_URL && (
        // A real footer: pinned to the bottom of the screen rather than
        // trailing the composition, which put it in the middle of the room.
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="coquiet-support flex items-center gap-2 text-[0.8125rem] sm:text-[clamp(0.8125rem,calc(0.625rem_+_0.2vw),1rem)]"
        >
          <CoffeeMarkInline />
          {SUPPORT_LABEL}
        </a>
      )}
    </div>
  );
}

