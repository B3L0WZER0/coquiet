/** The mark beside a presence line. */
export function LiveDot() {
  return (
    <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0 items-center justify-center">
      <span
        className="absolute h-3.5 w-3.5 rounded-full"
        style={{ backgroundColor: 'color-mix(in oklab, var(--color-cream) 12%, transparent)' }}
      />
      <span
        className="relative h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: 'color-mix(in oklab, var(--color-cream) 82%, transparent)' }}
      />
    </span>
  );
}
