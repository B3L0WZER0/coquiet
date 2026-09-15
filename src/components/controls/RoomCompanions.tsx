'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Popover } from '@/components/ui/Popover';
import { googleCalendarUrl, icsFile, planEnd, roomLink, suggestedSlots } from '@/lib/plan';

const circle =
  'control-surface flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-[var(--duration-control)] hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)]';

const action =
  'rounded-full border border-[var(--hairline)] px-3 py-1.5 text-[0.8125rem] transition-colors duration-[var(--duration-control)] hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)]';

/** Invite a friend, and plan the next session. `mobile`: top-right of a phone,
 *  so panels drop down from the right edge and lead with the phone's own tools. */
export function RoomCompanions({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      <InviteButton mobile={mobile} />
      <PlanButton mobile={mobile} />
    </>
  );
}

// Written out in full so Tailwind sees every class.
const PANEL_WIDTH = {
  invite: { desk: 'w-[17.5rem]', phone: 'w-[min(17.5rem,calc(100vw-2rem))]' },
  plan: { desk: 'w-[19rem]', phone: 'w-[min(19rem,calc(100vw-2rem))]' },
};

function panelPlacement(mobile: boolean, panel: keyof typeof PANEL_WIDTH) {
  return mobile
    ? ({ placement: 'bottom', align: 'end', panelClassName: PANEL_WIDTH[panel].phone } as const)
    : ({ placement: 'top', align: 'start', panelClassName: PANEL_WIDTH[panel].desk } as const);
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

function InviteButton({ mobile }: { mobile: boolean }) {
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
      {...panelPlacement(mobile, 'invite')}
      offset={10}
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
          {/* A phone's share sheet is where its messaging apps are, so it leads there. */}
          <div className="mt-1 flex items-center gap-2">
            <button type="button" className={action} onClick={copy}>
              Copy link
            </button>
            {canShare && (
              <button type="button" className={`${action} ${mobile ? 'order-first' : ''}`} onClick={share}>
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

function PlanButton({ mobile }: { mobile: boolean }) {
  return (
    <Popover
      label="Plan your next session"
      revealOnHoverAndFocus={false}
      {...panelPlacement(mobile, 'plan')}
      offset={10}
      triggerClassName={circle}
      // Mounted only while open, so "later today" never goes stale.
      panel={<PlanPanel mobile={mobile} />}
    >
      <CalendarMark />
    </Popover>
  );
}

function PlanPanel({ mobile }: { mobile: boolean }) {
  // An iPhone opens an .ics straight into "Add to Calendar"; Android and the
  // desk more often mean Google.
  const appleFirst = mobile && !/Android/i.test(navigator.userAgent);
  const slots = useMemo(() => suggestedSlots(new Date()), []);
  // Nothing chosen at first, so picking a time visibly unlocks the next step.
  const [chosen, setChosen] = useState<number | null>(null);
  const start = chosen === null ? null : slots[chosen].start;
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

  function openGoogle() {
    if (!start) return;
    window.open(googleCalendarUrl(start, roomLink(window.location)), '_blank', 'noopener');
  }

  function downloadIcs() {
    if (!start) return;
    const now = new Date();
    const ics = icsFile(start, roomLink(window.location), now, `${start.getTime()}-${now.getTime()}`);
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coquiet-session.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const calendarButton =
    'min-h-11 flex-1 rounded-full px-3 py-2 text-[0.8125rem] transition-colors duration-[var(--duration-control)] disabled:opacity-40';

  return (
    <div className="flex flex-col">
      <p className="text-[0.9375rem]" style={{ color: 'var(--text-primary)' }}>
        Plan your next session
      </p>
      <p className="mt-1 text-[0.8125rem] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Two hours in the room, in your calendar. Invite a friend as a guest to come along.
      </p>

      <fieldset className="mt-4 border-0 p-0">
        <legend className="label-quiet mb-2">1. Pick a time</legend>
        <div className="flex flex-wrap gap-1.5">
          {slots.map((slot, i) => (
            <button
              key={slot.start.getTime()}
              type="button"
              aria-pressed={i === chosen}
              onClick={() => setChosen(i === chosen ? null : i)}
              className="chip-select flex min-h-11 items-center rounded-full px-3.5 py-2 text-[0.8125rem] transition-all duration-[var(--duration-control)]"
            >
              {slot.day === 'today' ? 'Today' : 'Tomorrow'} {time.format(slot.start)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4 border-0 p-0" disabled={!start}>
        <legend className="label-quiet mb-2">2. Add it to your calendar</legend>
        {/* Always rendered, so the panel doesn't grow when a time is picked. */}
        <p className="mb-2 text-[0.8125rem]" style={{ color: start ? 'var(--text-primary)' : 'var(--text-muted)' }} aria-live="polite">
          {start ? `${time.format(start)} – ${time.format(planEnd(start))}` : 'Pick a time first'}
        </p>
        <div className={`flex gap-1.5 ${appleFirst ? 'flex-row-reverse' : ''}`}>
          <button
            type="button"
            onClick={openGoogle}
            className={calendarButton}
            style={{ backgroundColor: 'var(--surface-active)', border: '1px solid var(--hairline-strong)', color: 'var(--text-primary)' }}
          >
            Google Calendar
          </button>
          <button
            type="button"
            onClick={downloadIcs}
            className={calendarButton}
            style={{ backgroundColor: 'var(--surface-active)', border: '1px solid var(--hairline-strong)', color: 'var(--text-primary)' }}
          >
            Apple / Outlook
          </button>
        </div>
      </fieldset>
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
