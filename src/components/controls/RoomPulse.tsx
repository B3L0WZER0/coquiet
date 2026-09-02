'use client';

import { ACTIVITY_MARKS } from '@/components/icons/ActivityMarks';
import { DRINK_MARKS } from '@/components/icons/DrinkMarks';
import {
  MIN_GROUP_FOR_BREAKDOWN,
  type RoomPulse as Pulse,
} from '@/lib/presence/aggregate';

/**
 * The Room pulse panel.
 *
 * Aggregate counts only — no identities, no flags, no map, no ranking. With
 * fewer than a handful of people the breakdown is withheld entirely, because at
 * that size "1 reading · 1 tea" describes a person rather than a room.
 */
export function RoomPulse({ pulse }: { pulse: Pulse }) {
  if (!pulse.showBreakdown) {
    return (
      <p
        className="text-[0.75rem] leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        Just a few of you here. The room&rsquo;s pulse appears once{' '}
        {MIN_GROUP_FOR_BREAKDOWN} people are in.
      </p>
    );
  }

  const nothingShared =
    pulse.activities.length === 0 && pulse.drinks.length === 0;

  return (
    <div>
      {/* Two columns rather than wrapping. Counts vary from one digit to four,
          so a wrapping row left items landing wherever the widths happened to
          fall. */}
      {pulse.activities.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {pulse.activities.map((entry) => {
            const Mark = ACTIVITY_MARKS[entry.key];
            return (
              <PulseRow
                key={entry.key}
                mark={<Mark />}
                count={entry.count}
                label={entry.key}
              />
            );
          })}
        </ul>
      )}

      {pulse.activities.length > 0 && pulse.drinks.length > 0 && (
        // The two lists answer different questions; the rule keeps them from
        // reading as one long tally.
        <hr
          className="my-2.5 border-0"
          style={{ height: 1, backgroundColor: 'var(--hairline)' }}
        />
      )}

      {pulse.drinks.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {pulse.drinks.map((entry) => {
            const Mark = DRINK_MARKS[entry.key];
            return (
              <PulseRow
                key={entry.key}
                mark={<Mark />}
                count={entry.count}
                label={entry.key}
              />
            );
          })}
        </ul>
      )}

      {nothingShared && (
        <p
          className="text-[0.75rem]"
          style={{ color: 'var(--text-secondary)' }}
        >
          Nobody has said what they&rsquo;re up to yet.
        </p>
      )}
    </div>
  );
}

function PulseRow({
  mark,
  count,
  label,
}: {
  mark: React.ReactNode;
  count: number;
  label: string;
}) {
  return (
    <li
      className="flex items-center gap-1.5 text-[0.8125rem]"
      style={{ color: 'var(--text-primary)' }}
    >
      <span className="shrink-0" style={{ color: 'var(--color-taupe)' }}>
        {mark}
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</span>{' '}
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </li>
  );
}
