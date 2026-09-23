'use client';

import { NoteMark } from '@/components/icons/DockMarks';
import { SceneMark } from '@/components/icons/SceneMarks';
import { Popover } from '@/components/ui/Popover';
import { isAmbientId } from '@/lib/ambient';
import { CHANNELS, type Channel, type ChannelId } from '@/lib/channels';

/** Still · Flow · Momentum — or, in the Ambient room, Blue · Green · White
 *  with their marks — and an info mark alongside. */
export function MusicSelector({
  value,
  onChange,
  info,
  compact = false,
  channels = CHANNELS,
}: {
  value: ChannelId;
  onChange: (id: ChannelId) => void;
  /** The info affordance, placed just outside the switch's right edge. */
  info?: React.ReactNode;
  /** Narrow screens: collapse to a single dock button opening a channel sheet. */
  compact?: boolean;
  channels?: readonly Channel[];
}) {
  const ambient = channels[0]?.kind === 'ambient';
  const groupLabel = ambient ? 'Ambient scene' : 'Music channel';
  if (compact) {
    return <CompactMusic value={value} onChange={onChange} channels={channels} groupLabel={groupLabel} />;
  }

  return (
    <div className="relative flex items-center gap-2">
      {/* An empty twin of the info mark on the left. */}
      <span aria-hidden="true" className="h-5 w-5 shrink-0" />

      <div
        role="radiogroup"
        aria-label={groupLabel}
        className="control-surface flex items-center gap-0.5 rounded-full p-1"
        style={{ minHeight: 'var(--control-height)' }}
      >
        {channels.map((channel) => {
          const active = channel.id === value;
          return (
            <button
              key={channel.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(channel.id)}
              className="relative inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.8125rem] tracking-[0.04em] transition-all duration-[var(--duration-control)] ease-[var(--ease-quiet)] sm:px-4"
              style={{
                backgroundColor: active ? 'var(--surface-active)' : 'transparent',
                border: `1px solid ${active ? 'var(--hairline-strong)' : 'transparent'}`,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {isAmbientId(channel.id) && <SceneMark id={channel.id} />}
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

/** The dock version: a note glyph that opens the three channels as a list,
 *  each with the line that used to live behind the ⓘ. */
function CompactMusic({
  value,
  onChange,
  channels,
  groupLabel,
}: {
  value: ChannelId;
  onChange: (id: ChannelId) => void;
  channels: readonly Channel[];
  groupLabel: string;
}) {
  const current = channels.find((c) => c.id === value) ?? channels[0];

  return (
    <Popover
      label={`${groupLabel}: ${current.label}. Change it.`}
      revealOnHoverAndFocus={false}
      placement="top"
      align="center"
      offset={12}
      dock
      triggerClassName="dock-trigger"
      panel={
        <div>
          <p className="label-quiet mb-2">{groupLabel}</p>
          <div role="radiogroup" aria-label={groupLabel} className="space-y-1.5">
            {channels.map((channel) => {
              const active = channel.id === value;
              return (
                <button
                  key={channel.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange(channel.id)}
                  // Selected uses the warm sand tint the timer and presence
                  // chips use — a darker "well" is ink-on-ink here and all but
                  // invisible against the panel.
                  className="w-full rounded-xl px-3 py-2 text-left transition-colors duration-[var(--duration-control)]"
                  style={{
                    backgroundColor: active
                      ? 'color-mix(in oklab, var(--color-sand) 30%, transparent)'
                      : 'transparent',
                    border: `1px solid ${
                      active
                        ? 'color-mix(in oklab, var(--color-sand) 70%, transparent)'
                        : 'var(--hairline)'
                    }`,
                  }}
                >
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--color-cream)' }}>
                    {isAmbientId(channel.id) && <SceneMark id={channel.id} />}
                    <span
                      className="text-[0.8125rem] tracking-[0.02em]"
                      style={{ color: 'var(--color-cream)' }}
                    >
                      {channel.label}
                    </span>
                    {active && (
                      <span
                        className="label-quiet"
                        style={{ color: 'var(--color-sand)' }}
                      >
                        Playing
                      </span>
                    )}
                  </span>
                  <span
                    className="mt-0.5 block text-[0.75rem] leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {channel.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      }
    >
      {isAmbientId(current.id) ? <SceneMark id={current.id} size={20} /> : <NoteMark />}
      <span className="dock-label">{current.label}</span>
    </Popover>
  );
}
