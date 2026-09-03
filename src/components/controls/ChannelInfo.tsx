'use client';

import { Popover } from '@/components/ui/Popover';
import { CHANNELS } from '@/lib/channels';

/** The ⓘ beside MUSIC, explaining what the three channels are. */
export function ChannelInfo() {
  return (
    <Popover
      label="What the channels are"
      align="center"
      // Line the panel up with the whole selector rather than with this small
      // mark, which sits off to the right of centre. Anchoring to the selector
      // also puts `top-full` below the Still / Flow / Momentum row instead of
      // below the label, so the panel clears it rather than butting into it.
      anchorToAncestor
      offset={12}
      panelClassName="w-[17rem] sm:w-[20rem]"
      panel={
        <dl className="space-y-2.5 text-left">
          {CHANNELS.map((channel) => (
            <div key={channel.id}>
              <dt
                className="text-[0.8125rem] tracking-[0.02em]"
                style={{ color: 'var(--text-primary)' }}
              >
                {channel.label}
              </dt>
              <dd
                className="mt-0.5 text-[0.75rem] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {channel.description}
              </dd>
            </div>
          ))}
        </dl>
      }
    >
      <InfoMark />
    </Popover>
  );
}

/** The circle and the mark inside it are one drawing. */
function InfoMark() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="transition-opacity duration-[var(--duration-control)]"
    >
      <circle cx="10" cy="10" r="9.3" fill="none" stroke="var(--hairline)" strokeWidth="1" />
      {/* Dot and stem together span 5.15 to 14.85 — centred on 10. */}
      <g fill="var(--text-muted)">
        <circle cx="10" cy="6.1" r="0.95" />
        <rect x="9.05" y="8.6" width="1.9" height="6.25" rx="0.95" />
      </g>
    </svg>
  );
}
