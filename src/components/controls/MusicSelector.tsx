'use client';

import { CHANNELS, type ChannelId } from '@/lib/channels';

/**
 * Still · Flow · Momentum, with an info mark alongside.
 *
 * All three buttons stay translucent. The active one is a stronger warm tint
 * with a brighter border, full-contrast text and a fine indicator underneath —
 * never a solid fill or a glow.
 *
 * There is no "MUSIC" heading. Three channel names sitting above a play button
 * do not need to be told they are music, and the second row it required was the
 * only thing keeping this control from reading as one clean line.
 */
export function MusicSelector({
  value,
  onChange,
  info,
}: {
  value: ChannelId;
  onChange: (id: ChannelId) => void;
  /** The info affordance, placed just outside the switch's right edge. */
  info?: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center gap-2">
      {/*
        An empty twin of the info mark on the left. The mark would otherwise
        push the switch off the centre of the room by half its width, and the
        switch is what should look centred, not the switch-plus-mark. Mirroring
        it keeps the row symmetrical whatever size the mark ends up.
      */}
      <span aria-hidden="true" className="h-5 w-5 shrink-0" />

      <div
        role="radiogroup"
        aria-label="Music channel"
        className="control-surface flex items-center gap-0.5 rounded-full p-1"
        style={{ minHeight: 'var(--control-height)' }}
      >
        {CHANNELS.map((channel) => {
          const active = channel.id === value;
          return (
            <button
              key={channel.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(channel.id)}
              className="relative min-h-9 rounded-full px-3.5 py-1.5 text-[0.8125rem] tracking-[0.04em] transition-all duration-[var(--duration-control)] ease-[var(--ease-quiet)] sm:px-4"
              style={{
                backgroundColor: active ? 'var(--surface-active)' : 'transparent',
                border: `1px solid ${active ? 'var(--hairline-strong)' : 'transparent'}`,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {channel.label}
              <span
                aria-hidden="true"
                className="absolute bottom-1 left-1/2 h-px -translate-x-1/2 transition-all duration-[var(--duration-control)] ease-[var(--ease-quiet)]"
                style={{
                  width: active ? '0.875rem' : '0',
                  backgroundColor: 'color-mix(in oklab, var(--color-cream) 62%, transparent)',
                }}
              />
            </button>
          );
        })}
      </div>

      {info}
    </div>
  );
}
