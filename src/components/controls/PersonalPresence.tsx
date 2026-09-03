'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { ACTIVITY_MARKS } from '@/components/icons/ActivityMarks';
import { CoffeeMarkInline, DRINK_MARKS } from '@/components/icons/DrinkMarks';
import { presenceSummary } from '@/lib/presence/aggregate';
import {
  ACTIVITIES,
  DRINKS,
  type Activity,
  type Drink,
} from '@/lib/presence/types';
import { SUPPORT_LABEL, SUPPORT_URL } from '@/lib/support';

/** The optional personal presence control, bottom right. */
export function PersonalPresence({
  activity,
  drink,
  onChange,
  onClear,
}: {
  activity: Activity | null;
  drink: Drink | null;
  onChange: (activity: Activity | null, drink: Drink | null) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const summary = presenceSummary(activity, drink);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={
          summary
            ? `Your presence: ${summary}. Change it.`
            : 'Set your presence'
        }
        className="control-surface flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-[0.8125rem] transition-colors duration-[var(--duration-control)] hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)]"
        style={{
          color: summary ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
      >
        {/* The full phrase has room on desktop; at 320px it would push the play button off centre, so the trigger shortens instead of wrapping. */}
        <span className="hidden whitespace-nowrap md:inline">
          {summary ?? 'Set your presence'}
        </span>
        <span className="whitespace-nowrap md:hidden">
          {summary ?? 'Presence'}
        </span>
      </button>

      {open && (
        <>
          {/* On a narrow screen the sheet covers the playback controls, so the room behind it recedes rather than showing through. */}
          <div
            aria-hidden="true"
            onPointerDown={() => setOpen(false)}
            className="presence-scrim"
          />
          <div
            id={panelId}
            role="dialog"
            aria-modal="false"
            aria-label="Set your presence"
            className="presence-sheet"
          >
            <fieldset className="border-0 p-0">
              <legend className="label-quiet mb-2">I&rsquo;m…</legend>
              <div className="flex flex-wrap gap-1.5">
                {ACTIVITIES.map((option) => {
                  const Mark = ACTIVITY_MARKS[option];
                  return (
                    <Choice
                      key={option}
                      label={capitalise(option)}
                      active={activity === option}
                      mark={<Mark />}
                      // Choosing the same one again unsets it.
                      onClick={() =>
                        onChange(activity === option ? null : option, drink)
                      }
                    />
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-4 border-0 p-0">
              <legend className="label-quiet mb-2">…and having</legend>
              <div className="flex flex-wrap gap-1.5">
                {DRINKS.map((option) => {
                  const Mark =
                    option === 'nothing' ? null : DRINK_MARKS[option];
                  return (
                    <Choice
                      key={option}
                      label={capitalise(option)}
                      active={drink === option}
                      mark={Mark ? <Mark /> : undefined}
                      onClick={() =>
                        onChange(activity, drink === option ? null : option)
                      }
                    />
                  );
                })}
              </div>
            </fieldset>

            {SUPPORT_URL && (
              // A hairline sets it apart from the drinks above — it reads as
              // its own thing, not a fifth option alongside real presence.
              <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
                <a
                  href={SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="label-quiet flex items-center gap-2 transition-colors duration-[var(--duration-control)] hover:text-[var(--text-primary)]"
                >
                  <CoffeeMarkInline />
                  {SUPPORT_LABEL}
                </a>
              </div>
            )}

            <div className="mt-4 flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onClear();
                  close();
                }}
                disabled={!summary}
                className="min-h-11 flex-1 rounded-full px-3 py-2 text-[0.8125rem] transition-colors duration-[var(--duration-control)] disabled:opacity-40"
                style={{
                  border: '1px solid var(--hairline)',
                  color: 'var(--text-secondary)',
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={close}
                className="min-h-11 flex-1 rounded-full px-3 py-2 text-[0.8125rem] transition-colors duration-[var(--duration-control)]"
                style={{
                  backgroundColor: 'var(--surface-active)',
                  border: '1px solid var(--hairline-strong)',
                  color: 'var(--text-primary)',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Choice({
  label,
  active,
  mark,
  onClick,
}: {
  label: string;
  active: boolean;
  mark?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="chip-select flex min-h-11 items-center gap-1.5 rounded-full px-3.5 py-2 text-[0.8125rem] transition-all duration-[var(--duration-control)]"
    >
      {mark && <span className="chip-select-mark">{mark}</span>}
      {label}
    </button>
  );
}

function capitalise(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}
