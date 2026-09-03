'use client';

import { useState } from 'react';

import { ClockMark } from '@/components/icons/DockMarks';
import { Popover } from '@/components/ui/Popover';
import {
  CUSTOM_LIMITS,
  CUSTOM_PRESET_ID,
  PRESETS,
  clampMinutes,
  formatRemaining,
  isPaused,
  isRunning,
  phaseLabel,
  type TimerSession,
} from '@/lib/timer';

/** The compact timer, upper right, and the popover behind it. */
export function FocusTimer({
  session,
  remainingMs,
  onStart,
  onPause,
  onResume,
  onReset,
  onPreset,
  onCustom,
  compact = false,
}: {
  session: TimerSession;
  remainingMs: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onPreset: (id: string) => void;
  onCustom: (focusMinutes: number, breakMinutes: number) => void;
  /** Narrow screens: a dock button rather than a labelled pill. */
  compact?: boolean;
}) {
  const display = formatRemaining(remainingMs);
  const hint = phaseLabel(session);
  const running = isRunning(session);
  const paused = isPaused(session);
  const idle = !running && !paused;
  const focusMinutes = Math.round(session.focusMs / 60_000);

  return (
    <Popover
      // "Start, 25:00 remaining" would be nonsense read aloud — nothing is
      // counting down yet. Naming the length instead of showing a countdown
      // also makes clear, before opening the panel, what pressing it does.
      label={
        idle
          ? `Focus timer. Start a ${focusMinutes} minute session.`
          : `Focus timer, ${hint}, ${display} remaining`
      }
      // A timer is not something to open by brushing past, or by tabbing past.
      revealOnHoverAndFocus={false}
      placement={compact ? 'top' : 'bottom'}
      align="end"
      panelClassName="w-[16rem]"
      triggerClassName={
        compact
          ? 'dock-trigger'
          : 'control-surface flex min-h-11 items-center gap-2.5 rounded-full px-4 py-2 transition-colors duration-[var(--duration-control)] hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)]'
      }
      panel={
        <TimerPanel
          session={session}
          running={running}
          paused={paused}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onReset={onReset}
          onPreset={onPreset}
          onCustom={onCustom}
        />
      }
    >
      {compact ? (
        <>
          <ClockMark />
          {!idle && (
            <span
              className="text-[0.8125rem]"
              style={{
                color: 'var(--text-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {display}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="label-quiet" style={{ textShadow: 'var(--shadow-legible)' }}>
            {idle ? 'Start Timer' : hint}
          </span>
          <span
            className="text-[0.9375rem]"
            style={{
              color: 'var(--text-primary)',
              fontVariantNumeric: 'tabular-nums',
              textShadow: 'var(--shadow-legible)',
            }}
          >
            {display}
          </span>
        </>
      )}
    </Popover>
  );
}

function TimerPanel({
  session,
  running,
  paused,
  onStart,
  onPause,
  onResume,
  onReset,
  onPreset,
  onCustom,
}: {
  session: TimerSession;
  running: boolean;
  paused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onPreset: (id: string) => void;
  onCustom: (focusMinutes: number, breakMinutes: number) => void;
}) {
  const custom = session.presetId === CUSTOM_PRESET_ID;
  const [focusMinutes, setFocusMinutes] = useState(() => Math.round(session.focusMs / 60_000));
  const [breakMinutes, setBreakMinutes] = useState(() => Math.round(session.breakMs / 60_000));

  const idle = session.phase === 'idle' || session.phase === 'break-ended';

  return (
    <div className="space-y-3">
      <div>
        <p className="label-quiet mb-1">Focus timer</p>
        <p className="text-[0.75rem]" style={{ color: 'var(--text-secondary)' }}>
          Work for a set stretch, then take a short break.
        </p>
      </div>

      <div role="radiogroup" aria-label="Session length" className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <PresetChip
            key={preset.id}
            label={preset.label}
            active={session.presetId === preset.id}
            onClick={() => onPreset(preset.id)}
          />
        ))}
        <PresetChip
          label="Custom"
          active={custom}
          onClick={() => onCustom(focusMinutes, breakMinutes)}
        />
      </div>

      {custom && (
        <div className="flex items-end gap-2">
          <MinutesField
            label="Focus"
            value={focusMinutes}
            min={CUSTOM_LIMITS.focus.min}
            max={CUSTOM_LIMITS.focus.max}
            onChange={(v) => {
              setFocusMinutes(v);
              onCustom(v, breakMinutes);
            }}
          />
          <MinutesField
            label="Break"
            value={breakMinutes}
            min={CUSTOM_LIMITS.break.min}
            max={CUSTOM_LIMITS.break.max}
            onChange={(v) => {
              setBreakMinutes(v);
              onCustom(focusMinutes, v);
            }}
          />
        </div>
      )}

      <div className="flex gap-1.5 pt-0.5">
        {idle && (
          <PanelButton
            primary
            label={`Start timer · ${Math.round(session.focusMs / 60_000)} min`}
            onClick={onStart}
          />
        )}
        {running && <PanelButton primary label="Pause" onClick={onPause} />}
        {paused && <PanelButton primary label="Resume" onClick={onResume} />}
        {!idle && <PanelButton label="Reset" onClick={onReset} />}
      </div>
    </div>
  );
}

function PresetChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className="chip-select min-h-9 rounded-full px-3 py-1.5 text-[0.75rem] tracking-[0.02em] transition-all duration-[var(--duration-control)]"
    >
      {label}
    </button>
  );
}

function MinutesField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex-1">
      <span className="label-quiet mb-1 block">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(v)) onChange(v);
        }}
        // Correct out-of-range entries when the field is done with, not while
        // someone is still typing. Snapping mid-keystroke fights the typist,
        // and leaving it uncorrected lets the field disagree with the timer —
        // the field showing what was typed while the session holds the clamped
        // value.
        onBlur={() => {
          const clamped = clampMinutes(value, { min, max });
          if (clamped !== value) onChange(clamped);
        }}
        className="w-full min-h-9 rounded-lg px-2 py-1.5 text-[0.8125rem]"
        style={{
          backgroundColor: 'color-mix(in oklab, var(--color-ink) 40%, transparent)',
          border: '1px solid var(--hairline)',
          color: 'var(--text-primary)',
        }}
      />
    </label>
  );
}

function PanelButton({
  label,
  onClick,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-9 flex-1 rounded-full px-3 py-2 text-[0.8125rem] tracking-[0.03em] transition-colors duration-[var(--duration-control)]"
      style={{
        backgroundColor: primary ? 'var(--surface-active)' : 'transparent',
        border: `1px solid ${primary ? 'var(--hairline-strong)' : 'var(--hairline)'}`,
        color: primary ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
    >
      {label}
    </button>
  );
}
