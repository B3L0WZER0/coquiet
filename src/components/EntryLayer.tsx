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
      className="entry-layer fixed inset-0 z-30 transition-opacity duration-[900ms] ease-[var(--ease-quiet)]"
      style={{ opacity: leaving ? 0 : 1 }}
      // Once the layer starts dissolving it is no longer reachable; focus moves
      // into the room instead.
      inert={leaving ? true : undefined}
    >
      {/* Shade poured in from the left edge, so the type has a dark side of the
          room to sit on and the photograph keeps the rest of the frame. */}
      <div aria-hidden="true" className="entry-scrim pointer-events-none absolute inset-0 -z-10" />

      <div className="entry-frame">
        <Wordmark />

        {/* One column, ranged left: the name, what it is, then what to do. */}
        <div className="entry-copy">
          <h1 className="entry-headline">
            Focus quietly,
            {/* Broken by hand: the two halves of the phrase, one per line. */}
            <br />
            together.
          </h1>

          <p className="entry-sub">
            A shared room. A little music.
            <br />
            Quiet company for whatever needs your focus.
          </p>

          {/* The slot is always here, at its full height, even before anyone has been heard from. */}
          <div className="entry-presence-slot flex items-center">
            <p
              className="flex items-center gap-2.5 text-[0.875rem] transition-opacity duration-[600ms] ease-[var(--ease-quiet)]"
              style={{
                color: 'var(--text-secondary)',
                textShadow: 'var(--shadow-legible)',
                opacity: presenceLine ? 1 : 0,
              }}
              // The count can change while the entry screen is open; announce it
              // quietly rather than interrupting.
              aria-live="polite"
              aria-hidden={presenceLine ? undefined : true}
            >
              <LiveDot tone="sage" />
              {presenceLine ?? 'Room open'}
            </p>
          </div>

          <button type="button" onClick={onEnter} className="coquiet-cta">
            Enter the room
            <svg
              aria-hidden="true"
              width="17"
              height="17"
              viewBox="0 0 17 17"
              fill="none"
              className="entry-cta-arrow"
            >
              <path
                d="M2.5 8.5h11m-4.2-4.4 4.4 4.4-4.4 4.4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <p className="entry-reassurance">No chat. No cameras. Just company.</p>
        </div>
      </div>

      {/* A real footer: pinned to the bottom edge, one line across the screen. */}
      <div className="entry-footer">
        <p className="entry-footnote">Ambient sound fades in. Mute anytime.</p>

        {SUPPORT_URL && (
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="coquiet-support flex items-center gap-2"
          >
            <CoffeeMarkInline />
            {SUPPORT_LABEL}
          </a>
        )}
      </div>
    </div>
  );
}
