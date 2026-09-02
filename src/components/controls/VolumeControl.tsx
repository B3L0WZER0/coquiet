'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Discreet volume, beside play/pause.
 *
 * Collapsed it is just a small speaker mark. It expands on hover and on focus,
 * so the slider is reachable by pointer and keyboard alike. On touch there is
 * no hover, so pressing the mark both mutes and reveals the slider — muting is
 * the thing people reach for in a hurry, it is undone by pressing again, and
 * the slider is right there once the row has opened.
 *
 * Muting is a flag rather than a volume of zero, so the level chosen here is
 * still there to come back to.
 */
export function VolumeControl({
  volume,
  muted,
  onChange,
  onToggleMuted,
}: {
  volume: number;
  muted: boolean;
  onChange: (v: number) => void;
  onToggleMuted: () => void;
}) {
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [touched, setTouched] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const expanded = hovering || focusWithin || touched;
  const silent = muted || volume === 0;

  useEffect(() => {
    if (!touched) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setTouched(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [touched]);

  const percent = Math.round(volume * 100);

  return (
    <div
      ref={rootRef}
      className="control-surface flex h-11 items-center overflow-hidden rounded-full px-3 transition-[width,background-color,border-color] duration-[var(--duration-control)] ease-[var(--ease-quiet)] hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)]"
      style={{
        width: expanded ? '9.5rem' : '2.75rem',
        // Collapsed, this is a circle with one mark in it, so the mark has to
        // land on the centre. The gap and the padding are both measured from
        // inside a 1px border, which left the speaker a pixel to the right;
        // centring the row and dropping the gap while the slider has no width
        // puts it back.
        justifyContent: expanded ? 'flex-start' : 'center',
        gap: expanded ? '0.5rem' : 0,
      }}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setFocusWithin(false);
      }}
    >
      <button
        type="button"
        onClick={() => {
          onToggleMuted();
          // On touch this is also how the slider gets revealed; on a pointer
          // device the row is already open and this changes nothing.
          setTouched(true);
        }}
        aria-label={silent ? 'Unmute' : 'Mute'}
        aria-pressed={silent}
        className="flex h-5 w-5 shrink-0 items-center justify-center transition-colors duration-[var(--duration-control)]"
        style={{
          color: silent ? 'var(--color-clay)' : 'var(--text-secondary)',
        }}
      >
        <SpeakerGlyph muted={silent} />
      </button>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        aria-label="Volume"
        aria-valuetext={
          muted ? `${percent} percent, muted` : `${percent} percent`
        }
        // Kept in the tab order while collapsed — focusing it is what expands
        // the row, so hiding it would strand keyboard users.
        className="coquiet-range h-1 min-w-0 flex-1"
        style={{ opacity: expanded ? 1 : 0 }}
        data-muted={muted || undefined}
      />
    </div>
  );
}

function SpeakerGlyph({ muted }: { muted: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
    >
      {/*
        The drawing is not centred in its own box: the waves reach further right
        than the cone reaches left, which left the mark sitting right of centre
        in the circle even though the <svg> itself was centred exactly.

        One constant nudge rather than a different one per state — the muted and
        unmuted marks have slightly different widths, and correcting each would
        make the cone jump sideways every time the button is pressed. This lands
        both within a tenth of a pixel of centre.
      */}
      <g transform="translate(-0.6 0.2)">
        <path
          d="M3 6h2.2L8.4 3.3a.5.5 0 0 1 .85.36v8.68a.5.5 0 0 1-.85.36L5.2 10H3a.6.6 0 0 1-.6-.6V6.6A.6.6 0 0 1 3 6z"
          fill="currentColor"
        />
        {muted ? (
          <path
            d="M11.4 6.2 14 8.8M14 6.2l-2.6 2.6"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M11.3 5.9a3 3 0 0 1 0 4.2M13.1 4.4a5.4 5.4 0 0 1 0 7.2"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        )}
      </g>
    </svg>
  );
}
