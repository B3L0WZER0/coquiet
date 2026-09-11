'use client';

import { useEffect, useRef, useState } from 'react';

import { VOTES_API } from '@/lib/journal/config';

interface Votes {
  count: number;
  voted: boolean;
}

function isVotes(value: unknown): value is Votes {
  const v = value as Votes | null;
  return typeof v?.count === 'number' && typeof v?.voted === 'boolean';
}

/** "This helped" and "Share" at the foot of a post. */
export function PostActions({ slug, title }: { slug: string; title: string }) {
  // Null until the votes service has answered. Without it (local dev, a
  // github.io build) the button never appears rather than doing nothing.
  const [votes, setVotes] = useState<Votes | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const url = `${VOTES_API}/${slug}`;

  useEffect(() => {
    let live = true;
    fetch(url, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => {
        if (live && isVotes(d)) setVotes(d);
      })
      .catch(() => {});
    return () => {
      live = false;
      clearTimeout(noteTimer.current);
    };
  }, [url]);

  async function toggleVote() {
    if (!votes || busy) return;
    const before = votes;
    const voted = !before.voted;
    setVotes({ count: before.count + (voted ? 1 : -1), voted });
    setBusy(true);
    try {
      const r = await fetch(url, { method: voted ? 'POST' : 'DELETE' });
      const d: unknown = r.ok ? await r.json() : null;
      setVotes(isVotes(d) ? d : before);
    } catch {
      setVotes(before);
    } finally {
      setBusy(false);
    }
  }

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
      {votes && (
        <button
          type="button"
          className="journal-pill"
          aria-pressed={votes.voted}
          onClick={toggleVote}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
            <path
              d="M8 13.5S2.5 10.2 2.5 6.2A2.7 2.7 0 0 1 8 4.8a2.7 2.7 0 0 1 5.5 1.4c0 4-5.5 7.3-5.5 7.3Z"
              fill={votes.voted ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          {votes.voted ? 'Glad it helped' : 'This helped'}
          {votes.count > 0 && <span className="journal-pill-count">{votes.count}</span>}
        </button>
      )}
      <p className="journal-note" aria-live="polite">
        {note}
      </p>
    </div>
  );
}
