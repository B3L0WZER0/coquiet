'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

type Placement = 'top' | 'bottom';
type Align = 'start' | 'center' | 'end';

/** A small translucent panel anchored to a trigger. */
export function Popover({
  label,
  children,
  panel,
  placement = 'bottom',
  align = 'center',
  className,
  panelClassName,
  /** Tooltip semantics: the panel reveals on hover and on focus as well as on press. */
  revealOnHoverAndFocus = true,
  offset = 8,
  triggerClassName,
  anchorToAncestor = false,
}: {
  /** Accessible name for the trigger. */
  label: string;
  /** Trigger contents. */
  children: React.ReactNode;
  panel: React.ReactNode;
  placement?: Placement;
  align?: Align;
  className?: string;
  panelClassName?: string;
  revealOnHoverAndFocus?: boolean;
  /** Gap between trigger and panel, in pixels. */
  offset?: number;
  /** Styling for the trigger itself, when it is more than a bare glyph. */
  triggerClassName?: string;
  /** Position the panel against the nearest positioned ancestor instead of against the trigger. */
  anchorToAncestor?: boolean;
}) {
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const open = pinned || (revealOnHoverAndFocus && (hovering || focusWithin));

  const close = useCallback(() => {
    setPinned(false);
    setHovering(false);
    setFocusWithin(false);
  }, []);

  // Escape closes and returns focus to the trigger, so keyboard visitors are
  // never stranded inside a panel that has gone away.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
      triggerRef.current?.focus();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  const alignClass =
    align === 'start'
      ? 'left-0'
      : align === 'end'
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2';

  const placementClass = placement === 'top' ? 'bottom-full' : 'top-full';

  return (
    <div
      ref={rootRef}
      className={`${anchorToAncestor ? '' : 'relative'} ${className ?? ''}`}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusWithin(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setPinned((p) => !p)}
        className={triggerClassName ?? 'flex items-center justify-center'}
      >
        {children}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className={`control-surface absolute z-20 rounded-2xl px-4 py-3 ${placementClass} ${alignClass} ${panelClassName ?? ''}`}
          style={{
            backgroundColor: 'var(--surface-panel)',
            [placement === 'top' ? 'marginBottom' : 'marginTop']: offset,
          }}
        >
          {panel}
        </div>
      )}
    </div>
  );
}
