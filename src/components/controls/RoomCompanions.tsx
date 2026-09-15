'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Popover } from '@/components/ui/Popover';
import { googleCalendarUrl, icsFile, roomLink, suggestedSlots } from '@/lib/plan';

const circle =
  'control-surface flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-[var(--duration-control)] hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)]';

const action =
  'rounded-full border border-[var(--hairline)] px-3 py-1.5 text-[0.8125rem] transition-colors duration-[var(--duration-control)] hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)]';

/** Desktop only for now: invite a friend, and plan the next session. */
export function RoomCompanions() {
  return (
    <>
      <InviteButton />
      <PlanButton />
    </>
  );
}

function useNote() {
  const [note, setNote] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [
    note,
    (text: string) => {
      setNote(text);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setNote(''), 2600);
    },
  ] as const;
}

function InviteButton() {
  const [note, say] = useNote();
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === 'function'), []);

  async function copy() {
    const link = roomLink(window.location);
    try {
      await navigator.clipboard.writeText(link);
      say('Link copied');
    } catch {
      say(link);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'Coquiet', text: 'Come focus with me.', url: roomLink(window.location) });
    } catch {
      // A dismissed share sheet is not worth mentioning.
    }
  }

  return (
    <Popover
      label="Invite a friend"
      revealOnHoverAndFocus={false}
      placement="top"
      align="start"
      offset={10}
      panelClassName="w-[17.5rem]"
      triggerClassName={circle}
      panel={
        <div className="flex flex-col gap-2">
          <p className="text-[0.9375rem]" style={{ color: 'var(--text-primary)' }}>
            Bring someone along
          </p>
          <p className="text-[0.8125rem] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Focus comes easier in good company. Send a friend the room — you’ll hear the same music
            at the same moment.
          </p>
          <div className="mt-1 flex items-center gap-2">
            <button type="button" className={action} onClick={copy}>
              Copy link
            </button>
            {canShare && (
              <button type="button" className={action} onClick={share}>
                Share…
              </button>
            )}
            <span className="text-[0.75rem]" style={{ color: 'var(--text-muted)' }} aria-live="polite">
              {note}
            </span>
          </div>
        </div>
      }
    >
      <PersonPlusMark />
    </Popover>
  );
}

function PlanButton() {
  // Recomputed each time the panel mounts, so "later today" never goes stale.
  return (
    <Popover
      label="Plan your next session"
      revealOnHoverAndFocus={false}
      placement="top"
      align="start"
      offset={10}
      panelClassName="w-[18.5rem]"
      triggerClassName={circle}
      panel={<PlanPanel />}
    >
      <CalendarMark />
    </Popover>
  );
}

function PlanPanel() {
  const slots = useMemo(() => suggestedSlots(new Date()), []);
  const [chosen, setChosen] = useState(0);
  const start = slots[chosen].start;
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

  function downloadIcs() {
    const now = new Date();
    const ics = icsFile(start, roomLink(window.location), now, `${start.getTime()}-${now.getTime()}`);
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coquiet-session.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.9375rem]" style={{ color: 'var(--text-primary)' }}>
        Plan your next session
      </p>
      <p className="text-[0.8125rem] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Two hours in the room, in your calendar. Invite a friend as a guest to come along.
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Start time">
        {slots.map((slot, i) => (
          <button
            key={slot.start.getTime()}
            type="button"
            aria-pressed={i === chosen}
            onClick={() => setChosen(i)}
            className={action}
            style={
              i === chosen
                ? { backgroundColor: 'var(--surface-strong)', borderColor: 'var(--hairline-strong)', color: 'var(--text-primary)' }
                : { color: 'var(--text-secondary)' }
            }
          >
            {slot.day === 'today' ? 'Today' : 'Tomorrow'} {time.format(slot.start)}
          </button>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]">
        <a
          href={googleCalendarUrl(start, roomLink(window.location))}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-[var(--hairline-strong)] underline-offset-4 hover:decoration-current"
          style={{ color: 'var(--text-primary)' }}
        >
          Google Calendar
        </a>
        <button
          type="button"
          onClick={downloadIcs}
          className="underline decoration-[var(--hairline-strong)] underline-offset-4 hover:decoration-current"
          style={{ color: 'var(--text-primary)' }}
        >
          Apple / Outlook
        </button>
      </div>
    </div>
  );
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function PersonPlusMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8" cy="7" r="2.8" {...stroke} />
      <path d="M2.8 16.2c.6-2.8 2.6-4.4 5.2-4.4s4.6 1.6 5.2 4.4" {...stroke} />
      <path d="M15.6 6.4v4.4M13.4 8.6h4.4" {...stroke} />
    </svg>
  );
}

function CalendarMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3.4" y="4.6" width="13.2" height="11.8" rx="2" {...stroke} />
      <path d="M3.4 8.4h13.2M7 3v3M13 3v3" {...stroke} />
    </svg>
  );
}
