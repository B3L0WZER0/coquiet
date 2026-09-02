'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { globalHour, noteForHour } from '@/lib/notes';

/** How long a note stays before it fades away again. */
const VISIBLE_MS = 10_000;

/**
 * The transient focus note.
 *
 * Shown on entering the room, at the start of each new focus session, and when
 * a new global hour begins — then it fades. It is never permanently visible,
 * and the text always comes from the hour, so everyone in the room is reading
 * the same line at the same time.
 */
export function useFocusNote(active: boolean) {
  const [text, setText] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | null>(null);

  const show = useCallback((at: number = Date.now()) => {
    setText(noteForHour(at));
    setVisible(true);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), VISIBLE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  // Watch for the hour turning over. Checked on a coarse interval rather than
  // with one long timeout, so a laptop that slept through the boundary still
  // picks up the new note when it wakes.
  useEffect(() => {
    if (!active) return;
    let lastHour = globalHour();

    const check = () => {
      const hour = globalHour();
      if (hour === lastHour) return;
      lastHour = hour;
      show();
    };

    const id = window.setInterval(check, 15_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [active, show]);

  return { text, visible, show };
}
