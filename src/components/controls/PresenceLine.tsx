'use client';

import { RoomPulse } from '@/components/controls/RoomPulse';
import { PeopleMark } from '@/components/icons/DockMarks';
import { LiveDot } from '@/components/ui/LiveDot';
import { Popover } from '@/components/ui/Popover';
import { pulse as computePulse } from '@/lib/presence/aggregate';
import { roomPresenceLine, type PresenceStatus } from '@/lib/presence/copy';
import type { PresenceSession } from '@/lib/presence/types';

/** One persistent handle on who else is in the room — a labelled pill in the
 *  bottom-left on desktop, a figure-and-count dock button on mobile. Both open
 *  the Room pulse. */
export function PresenceLine({
  status,
  sessions,
  dock = false,
}: {
  status: PresenceStatus;
  sessions: readonly PresenceSession[];
  /** Narrow screens: render as a dock trigger in the bottom bar. */
  dock?: boolean;
}) {
  const label = roomPresenceLine(status);
  // No adapter, so no honest thing to put here.
  if (label === null) return null;

  const others = status.kind === 'live' ? Math.max(0, status.count - 1) : 0;

  if (dock) {
    return (
      <Popover
        label={`${label}. Room pulse.`}
        revealOnHoverAndFocus={false}
        placement="top"
        align="center"
        offset={12}
        panelClassName="w-[16rem]"
        triggerClassName="dock-trigger"
        panel={<RoomPulse pulse={computePulse(sessions)} />}
      >
        <PeopleMark />
        {others > 0 && (
          <span
            className="text-[0.8125rem]"
            style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
          >
            {others}
          </span>
        )}
      </Popover>
    );
  }

  return (
    <Popover
      label={`${label}. Room pulse.`}
      // Presence is glanceable; opening the panel should be deliberate.
      revealOnHoverAndFocus={false}
      placement="top"
      align="start"
      offset={10}
      panelClassName="w-[17rem]"
      // A pill, matching the badge on the entry screen. As bare text this read
      // as a caption, and nobody thought to press it — which meant the Room
      // pulse behind it was effectively invisible.
      triggerClassName="control-surface flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-[0.8125rem] transition-colors duration-[var(--duration-control)] hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)]"
      panel={<RoomPulse pulse={computePulse(sessions)} />}
    >
      <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        <LiveDot />
        {label}
      </span>
    </Popover>
  );
}
