'use client';

import { useEffect, useId, useState } from 'react';

import { castVote, dismissPoll, retryUnsentVote, shouldAsk, type PollChoice } from '@/lib/ambient-poll';

/** Long enough to have settled into the room before being asked anything. */
const ASK_AFTER_MS = 6000;
const THANKS_MS = 2600;
const FADE_MS = 700;

type Phase = 'hidden' | 'asking' | 'thanks' | 'leaving' | 'done';

/** A small card, once per browser, asking whether the Ambient landscapes should move. */
export function AmbientPoll({ active, scene }: { active: boolean; scene: string }) {
  const [phase, setPhase] = useState<Phase>('hidden');
  const titleId = useId();

  useEffect(() => {
    void retryUnsentVote();
  }, []);

  useEffect(() => {
    if (!active || phase !== 'hidden' || !shouldAsk()) return;
    const t = window.setTimeout(() => setPhase('asking'), ASK_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [active, phase]);

  useEffect(() => {
    if (phase === 'thanks') {
      const t = window.setTimeout(() => setPhase('leaving'), THANKS_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === 'leaving') {
      const t = window.setTimeout(() => setPhase('done'), FADE_MS);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  if (phase === 'hidden' || phase === 'done') return null;

  const vote = (choice: PollChoice) => {
    void castVote(choice, scene);
    setPhase('thanks');
  };
  const close = () => {
    dismissPoll();
    setPhase('leaving');
  };

  return (
    <aside
      className="ambient-poll"
      data-leaving={phase === 'leaving' || undefined}
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && phase === 'asking') close();
      }}
    >
      {phase === 'asking' ? (
        <>
          <button type="button" className="ambient-poll-close" aria-label="Close" onClick={close}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <p id={titleId} className="ambient-poll-title">
            This is the new Ambient room. I hope you like it.
          </p>
          <p className="ambient-poll-body">
            Coquiet is meant to be still, so I thought hard about how much should move on screen. For
            the coast and the forest, which would you rather have?
          </p>
          <div className="ambient-poll-choices">
            <button type="button" className="ambient-poll-choice" onClick={() => vote('moving')}>
              Gently moving
            </button>
            <button type="button" className="ambient-poll-choice" onClick={() => vote('still')}>
              Keep it still
            </button>
          </div>
        </>
      ) : (
        <p id={titleId} className="ambient-poll-title" role="status">
          Thank you. Noted.
        </p>
      )}
    </aside>
  );
}
