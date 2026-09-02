'use client';

import { useEffect, useRef, useState } from 'react';

/** How long the room waits before the controls recede. */
const IDLE_MS = 8_000;

/**
 * Dim the controls after a stretch of inactivity.
 *
 * They return instantly on any pointer movement, touch, key press or scroll —
 * there is no fade-in delay to wait through. Anything that takes focus also
 * brings them back and holds them there, so a keyboard visitor tabbing slowly
 * through the room never has the control they are on fade out from under them.
 */
export function useIdleDim(enabled: boolean): boolean {
  const [dimmed, setDimmed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setDimmed(false);
      return;
    }

    const clear = () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };

    const arm = () => {
      clear();
      // While a control is showing a focus ring, the visitor is working the
      // room by keyboard even if the pointer is still — dimming the control
      // they are standing on would be exactly wrong.
      if (showingFocusRing()) return;
      timer.current = window.setTimeout(() => setDimmed(true), IDLE_MS);
    };

    const wake = () => {
      setDimmed(false);
      arm();
    };

    const events = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel', 'focusin'];
    for (const event of events) {
      document.addEventListener(event, wake, { passive: true });
    }
    // Focus leaving a control means idling can start counting again.
    document.addEventListener('focusout', arm, { passive: true });

    arm();

    return () => {
      for (const event of events) document.removeEventListener(event, wake);
      document.removeEventListener('focusout', arm);
      clear();
    };
  }, [enabled]);

  return dimmed;
}

/**
 * True when the focused element is drawing a visible focus ring.
 *
 * Deliberately narrower than "something has focus": clicking a control leaves
 * it focused, so treating any focus as activity would mean the room never dims
 * again after the first click. `:focus-visible` is precisely the distinction
 * the browser already makes between keyboard and pointer focus.
 */
function showingFocusRing(): boolean {
  const active = document.activeElement;
  if (!active || active === document.body || active === document.documentElement) return false;
  try {
    return active.matches(':focus-visible');
  } catch {
    // No support for the selector: fall back to holding the controls up,
    // which is the safe direction to be wrong in.
    return true;
  }
}
