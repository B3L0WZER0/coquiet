'use client';

import { formatRemaining } from '@/lib/timer';

/** The break, and the moment after it. */
export function BreakLayer({
  phase,
  remainingMs,
  suggestion,
  onBeginAgain,
}: {
  phase: 'break' | 'break-ended';
  remainingMs: number;
  suggestion: string;
  onBeginAgain: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(46% 34% at 50% 50%, color-mix(in oklab, var(--color-ink) 62%, transparent) 0%, transparent 74%)',
        }}
      />

      {phase === 'break' ? (
        <>
          <p
            className="text-[1.5rem] leading-snug font-light tracking-[0.015em] sm:text-[1.875rem]"
            style={{
              color: 'var(--text-primary)',
              textShadow: 'var(--shadow-legible)',
            }}
          >
            Take ten. The room will be here.
          </p>
          <p
            className="mt-3 text-[0.875rem]"
            style={{ color: 'var(--text-secondary)', textShadow: 'var(--shadow-legible)' }}
          >
            {suggestion}
          </p>
          <p
            className="mt-5 text-[0.8125rem]"
            style={{
              color: 'var(--text-muted)',
              fontVariantNumeric: 'tabular-nums',
              textShadow: 'var(--shadow-legible)',
            }}
            aria-label={`${formatRemaining(remainingMs)} of break remaining`}
          >
            {formatRemaining(remainingMs)}
          </p>
        </>
      ) : (
        <>
          <p
            className="text-[1.5rem] leading-snug font-light tracking-[0.015em] sm:text-[1.875rem]"
            style={{
              color: 'var(--text-primary)',
              textShadow: 'var(--shadow-legible)',
            }}
          >
            Welcome back.
          </p>
          <button
            type="button"
            onClick={onBeginAgain}
            className="control-surface mt-6 min-h-11 rounded-full px-7 py-3 text-[0.875rem] tracking-[0.05em] transition-colors duration-[var(--duration-control)] hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)]"
            style={{ color: 'var(--text-primary)' }}
          >
            Begin again
          </button>
        </>
      )}
    </div>
  );
}
