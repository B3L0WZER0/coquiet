'use client';

import { useEffect, useRef, useState } from 'react';

import { ArrowUpRight } from '@/components/journal/Arrows';

/** The share line at the foot of a post. */
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
    <div className="journal-share">
      <p>Enjoyed this? Pass it on to someone who could use a quieter day.</p>
      <div className="journal-share-end">
        <span className="journal-note" aria-live="polite">
          {note}
        </span>
        <button type="button" className="journal-textlink" onClick={share}>
          Share <ArrowUpRight />
        </button>
      </div>
    </div>
  );
}
