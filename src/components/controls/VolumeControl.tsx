'use client';

import { useEffect, useRef, useState } from 'react';

import { Popover } from '@/components/ui/Popover';

/** Discreet volume, beside play/pause. */
export function VolumeControl({
  volume,
  muted,
  onChange,
  onToggleMuted,
  compact = false,
}: {
  volume: number;
  muted: boolean;
  onChange: (v: number) => void;
  onToggleMuted: () => void;
  /** Narrow screens: a dock button opening the slider in a panel above. */
  compact?: boolean;
}) {
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [touched, setTouched] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const expanded = hovering || focusWithin || touched;
  const silent = muted || volume === 0;
  const percent = Math.round(volume * 100);

  useEffect(() => {
    if (!touched) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setTouched(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [touched]);

  if (compact) {
    return (
      <Popover
        label={silent ? `Volume ${percent} percent, muted. Adjust.` : `Volume ${percent} percent. Adjust.`}
        revealOnHoverAndFocus={false}
        placement="top"
        align="center"
        offset={12}
        panelClassName="w-[13rem]"
        triggerClassName="dock-trigger"
        panel={
          <div>
            <p className="label-quiet mb-2">Volume</p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onToggleMuted}
                aria-label={silent ? 'Unmute' : 'Mute'}
                aria-pressed={silent}
                className="flex h-6 w-6 shrink-0 items-center justify-center transition-colors duration-[var(--duration-control)]"
                style={{ color: silent ? 'var(--color-clay)' : 'var(--text-secondary)' }}
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
                aria-valuetext={muted ? `${percent} percent, muted` : `${percent} percent`}
                className="coquiet-range h-1 min-w-0 flex-1"
                data-muted={muted || undefined}
              />
            </div>
          </div>
        }
      >
        <SpeakerGlyph muted={silent} />
      </Popover>
    );
  }

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
      {/* The drawing is not centred in its own box: the waves reach further right than the cone reaches left, which left the mark sitting right of... */}
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
