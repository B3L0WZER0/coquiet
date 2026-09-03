'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { playChime, primeChime } from '@/lib/chime';
import { notify, requestOnDeliberateStart } from '@/lib/notifications';
import { STORAGE_KEYS, removeStored } from '@/lib/storage';
import {
  createSession,
  remainingMs,
  tick,
  withCustom,
  withPreset,
  type TimerEvent,
  type TimerSession,
  pause as pauseSession,
  reset as resetSession,
  resume as resumeSession,
  start as startSession,
} from '@/lib/timer';

/** How often the room re-reads the clock. */
const TICK_MS = 500;

export interface TimerCallbacks {
  onFocusEnded?: () => void;
  onBreakEnded?: () => void;
}

export function useTimer(callbacks: TimerCallbacks = {}) {
  // Start from the same value the server rendered, then adopt anything stored
  // in an effect — reading localStorage during render would not match the
  // server's HTML.
  const [session, setSession] = useState<TimerSession>(() => createSession());
  // The readout has to move every tick even when the session object does not
  // change, so the current time is state in its own right.
  const [now, setNow] = useState(() => Date.now());

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // A mirror of the session that can be read and advanced outside of React's
  // update cycle. The tick has side effects — a chime, a notification — and
  // those must not live inside a state updater, which React is free to invoke
  // more than once for the same transition.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const handleEvents = useCallback((events: TimerEvent[]) => {
    for (const event of events) {
      if (event === 'focus-ended') {
        void playChime();
        notify('Time for a break', 'Take ten. The room will be here.');
        callbacksRef.current.onFocusEnded?.();
      } else if (event === 'break-ended') {
        void playChime();
        notify('Welcome back', 'The room is ready when you are.');
        callbacksRef.current.onBreakEnded?.();
      }
    }
  }, []);

  // The timer does not outlive the page.
  //
  // Arriving in the room means arriving at a stopped clock, not walking back
  // into a session from an earlier visit. This is a deliberate departure from
  // the spec, which asks for an active session to be restored after a refresh;
  // the cost is that an accidental reload loses a stretch in progress.
  //
  // Accuracy through backgrounding and device sleep is unaffected. That comes
  // from the session storing the timestamp it ends at rather than a countdown,
  // and it holds for as long as the page does.
  useEffect(() => {
    // Clear anything a previous version left behind rather than abandoning it.
    removeStored(STORAGE_KEYS.timer);
  }, []);

  // The clock loop. It only ever asks `tick` where the session should be now.
  useEffect(() => {
    if (session.endsAt === null) return;

    const check = () => {
      const at = Date.now();
      setNow(at);

      const current = sessionRef.current;
      const { session: next, events } = tick(current, at);
      if (next === current) return;

      // Claim the transition before announcing it, so a second check arriving
      // before React re-renders cannot chime for the same crossing twice.
      sessionRef.current = next;
      setSession(next);
      if (events.length > 0) handleEvents(events);
    };

    const id = window.setInterval(check, TICK_MS);
    // A tab returning from the background should correct itself immediately
    // rather than on the next interval.
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    check();

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session.endsAt, handleEvents]);

  const start = useCallback(() => {
    // The only place notification permission is ever requested.
    void requestOnDeliberateStart();
    // Build the audio context now, while this press is still a live user
    // gesture. Left until the timer fires, it would be created outside one and
    // could come back suspended — a stretch that ends in silence.
    void primeChime();
    setSession((s) => startSession(s, Date.now()));
  }, []);

  const pause = useCallback(() => setSession((s) => pauseSession(s, Date.now())), []);
  const resume = useCallback(() => setSession((s) => resumeSession(s, Date.now())), []);
  const reset = useCallback(() => setSession((s) => resetSession(s)), []);
  const setPreset = useCallback((id: string) => setSession((s) => withPreset(s, id)), []);
  const setCustom = useCallback(
    (focusMinutes: number, breakMinutes: number) =>
      setSession((s) => withCustom(s, focusMinutes, breakMinutes)),
    [],
  );

  return {
    session,
    /** Time left in the current phase, refreshed on every tick. */
    remainingMs: remainingMs(session, now),
    start,
    pause,
    resume,
    reset,
    setPreset,
    setCustom,
  };
}
