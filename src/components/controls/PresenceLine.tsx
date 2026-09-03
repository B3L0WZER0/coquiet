'use client';

import { RoomPulse } from '@/components/controls/RoomPulse';
import { LiveDot } from '@/components/ui/LiveDot';
import { Popover } from '@/components/ui/Popover';
import { pulse as computePulse } from '@/lib/presence/aggregate';
import {
  roomPresenceLine,
  shortRoomPresenceLine,
  type PresenceStatus,
} from '@/lib/presence/copy';
import type { PresenceSession } from '@/lib/presence/types';

/** One persistent line about who is in the room — bottom left on desktop, the
 *  top-right corner on mobile. */
export function PresenceLine({
  status,
  sessions,
  compact = false,
}: {
  status: PresenceStatus;
  sessions: readonly PresenceSession[];
  /** Narrow screens: a terser label, and the panel drops below the trigger. */
  compact?: boolean;
}) {
  const label = roomPresenceLine(status);
  // No adapter, so no honest thing to put here.
  if (label === null) return null;

  const shown = compact ? (shortRoomPresenceLine(status) ?? label) : label;

  return (
    <Popover
      label={`${label}. Room pulse.`}
      // Presence is glanceable; opening the panel should be deliberate.
      revealOnHoverAndFocus={false}
      placement={compact ? 'bottom' : 'top'}
      align={compact ? 'end' : 'start'}
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
        {shown}
      </span>
    </Popover>
  );
}
