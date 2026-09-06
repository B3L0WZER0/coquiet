/** The mark beside a presence line. */
export function LiveDot({ tone = 'cream' }: { tone?: 'cream' | 'sage' }) {
  // The entry screen reads the dot as "the room is alive"; inside the room it
  // is one more quiet mark in a row of controls, so it stays cream there.
  const hue = tone === 'sage' ? 'var(--color-sage)' : 'var(--color-cream)';

  return (
    <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0 items-center justify-center">
      <span
        className="absolute h-3.5 w-3.5 rounded-full"
        style={{ backgroundColor: `color-mix(in oklab, ${hue} 12%, transparent)` }}
      />
      <span
        className="relative h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: `color-mix(in oklab, ${hue} 82%, transparent)` }}
      />
    </span>
  );
}
