'use client';

import { Wordmark } from '@/components/Wordmark';
import { BookMark } from '@/components/icons/BookMark';
import { CoffeeMarkInline, CoffeeMarkSteaming } from '@/components/icons/DrinkMarks';
import { LiveDot } from '@/components/ui/LiveDot';
import { VersionBadge } from '@/components/VersionBadge';
import { assetPath } from '@/lib/asset-path';
import { JOURNAL_PUBLIC } from '@/lib/journal/config';
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
  /** `byKeyboard` says whether the door was opened with Enter or Space, so the
      room knows whether moving focus would be a help or a stray highlight. */
  onEnter: (byKeyboard: boolean) => void;
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
        {/* Wrapped so the phone can set it as a small mark in the corner
            without touching the size it has inside the room. */}
        <div className="entry-wordmark">
          <Wordmark />
        </div>

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
              className="flex items-center gap-2.5 transition-opacity duration-[600ms] ease-[var(--ease-quiet)]"
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

          {/* One row: the door, and — on a phone, where there is no footer to
              put it in — the coffee beside it. */}
          <div className="entry-actions">
            <button
              type="button"
              // A click from the keyboard reports no pointer coordinates.
              onClick={(e) => onEnter(e.detail === 0)}
              className="coquiet-cta"
            >
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

            {SUPPORT_URL && (
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="coquiet-support"
                // The label is text on a desktop and a cup on a phone; the name
                // is the same either way.
                aria-label={SUPPORT_LABEL}
              >
                <span className="entry-support-inline">
                  <CoffeeMarkInline />
                </span>
                <span className="entry-support-round">
                  <CoffeeMarkSteaming />
                </span>
                <span className="entry-support-label">{SUPPORT_LABEL}</span>
              </a>
            )}
          </div>

          <p className="entry-reassurance">No chat. No cameras. Just company.</p>
        </div>
      </div>

      {/* Pinned to the bottom edge on a desktop; the phone has no room for it. */}
      <p className="entry-footnote">Ambient sound fades in. Mute anytime.</p>

      {/* Across from the name. After the door in the DOM, so a keyboard meets
          the door first; a full page load, like every link to the journal. */}
      {JOURNAL_PUBLIC && (
        <a href={assetPath('/journal/')} className="entry-journal">
          <BookMark />
          Journal
        </a>
      )}

      {/* Out of flow, in the corner under the support link — the quietest thing
          on the screen, and the last one anybody needs. */}
      <VersionBadge />

    </div>
  );
}
