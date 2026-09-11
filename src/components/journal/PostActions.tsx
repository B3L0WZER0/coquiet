'use client';

import { useEffect, useRef, useState } from 'react';

/** "Share" at the foot of a post. */
export function PostActions({ title }: { title: string }) {
  const [note, setNote] = useState('');
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(noteTimer.current), []);

  function say(text: string) {
    setNote(text);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(''), 2600);
  }

  async function share() {
    const link = window.location.href.split('#')[0];
    if (navigator.share) {
      try {
        await navigator.share({ title, url: link });
      } catch {
        // Dismissing the share sheet is not an error worth mentioning.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      say('Link copied');
    } catch {
      say(link);
    }
  }

  return (
    <div className="journal-actions">
      <p className="journal-actions-prompt">Enjoyed this? Pass it to someone who could use a quieter day.</p>
      <button type="button" className="journal-pill" onClick={share}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 10.5V2m0 0L5 5m3-3 3 3M3.5 8.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Share
      </button>
      <p className="journal-note" aria-live="polite">
        {note}
      </p>
    </div>
  );
}
