'use client';

import { Wordmark } from '@/components/Wordmark';
import { CoffeeMarkInline } from '@/components/icons/DrinkMarks';
import { LiveDot } from '@/components/ui/LiveDot';
import { SUPPORT_LABEL, SUPPORT_URL } from '@/lib/support';

/**
 * The composition shown before the room is entered.
 *
 * Its job is to say what this is in one glance and then get out of the way.
 * Nothing here starts audio implicitly — sound begins only when the visitor
 * presses "Enter the room", and the line beneath the button says so.
 */
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
      {/*
        The pool of shade spans the whole viewport rather than a box drawn round
        the text.

        Sized to the content it had only its own width to fade across, so the
        falloff was necessarily short and the ellipse showed itself as a shape
        sitting on the room. Given the whole frame it has room to fade over
        hundreds of pixels and simply reads as the light being lower in the
        middle of the room. It also no longer depends on how tall the content
        is, so nothing about it can move when the presence badge resolves.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(66% 82% at 50% 50%, color-mix(in oklab, var(--color-ink) 84%, transparent) 0%, color-mix(in oklab, var(--color-ink) 76%, transparent) 16%, color-mix(in oklab, var(--color-ink) 58%, transparent) 31%, color-mix(in oklab, var(--color-ink) 36%, transparent) 46%, color-mix(in oklab, var(--color-ink) 18%, transparent) 61%, color-mix(in oklab, var(--color-ink) 6%, transparent) 79%, transparent 100%)',
        }}
      />

      {/* Lifted off the optical centre: the footer below pulls the eye down,
          and centring the block on the viewport left it sitting low. */}
      <div className="relative flex -translate-y-7 flex-col items-center">
        <Wordmark size="lg" />

        {/*
          Sized well below the wordmark on purpose. At close to the same size
          the two read as a pair competing for the eye rather than as a name
          and the line that explains it.
        */}
        <h1
          className="mt-5 text-[1.125rem] leading-snug font-normal sm:mt-[1.625rem] sm:text-[1.375rem]"
          style={{ color: 'var(--text-primary)', textShadow: 'var(--shadow-legible)' }}
        >
          Focus quietly, together
        </h1>

        <p
          // `text-balance` evens the lines out. At its natural measure the last
          // line held two words on its own, which read as the sentence having
          // been cut off rather than as a paragraph ending.
          className="mt-4 max-w-[32ch] text-[0.9375rem] leading-relaxed text-balance sm:mt-[1.125rem] sm:max-w-[46ch] sm:text-[1rem]"
          style={{ color: 'var(--text-secondary)', textShadow: 'var(--shadow-legible)' }}
        >
          Step into a shared room and work alongside other people. No chat, no cameras — just
          synchronised music and the quiet company of others concentrating.
        </p>

        {/*
          The slot is always here, at its full height, even before anyone has
          been heard from. The badge cannot be in the server's HTML — there is
          nothing to count until the page is listening — and the browser paints
          that HTML before any of this runs, so a badge that simply appeared
          would push the whole composition down a frame after it was drawn.
        */}
        <div className="mt-6 flex min-h-9 items-center">
          <p
            className="control-surface flex min-h-9 items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] transition-opacity duration-[600ms] ease-[var(--ease-quiet)]"
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

        {/* Without a count to show there is one less step down to the button,
            so the gap opens up rather than leaving a hole. */}
        <button type="button" onClick={onEnter} className="coquiet-cta mt-[0.9375rem]">
          Enter the room
        </button>

        {/* Sits lowest, where the scrim is thinnest, and it promises an
            affordance — so it is the one small line that does not get to be
            the quietest colour. */}
        <p
          className="mt-[1.1875rem] text-[0.8125rem]"
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
          className="coquiet-support absolute flex items-center gap-2 text-[0.8125rem]"
          style={{
            bottom: 'calc(var(--inset-b) + 1.5rem)',
            right: 'calc(var(--inset-r) + 1.75rem)',
          }}
        >
          <CoffeeMarkInline />
          {SUPPORT_LABEL}
        </a>
      )}
    </div>
  );
}

