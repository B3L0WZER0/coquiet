/**
 * Line marks for the three drinks.
 *
 * Drawn as single-weight strokes in the room's own palette — the same
 * restraint as the wordmark. No emoji, no fills, no cartoon.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      {children}
    </svg>
  );
}

/** A small cup on a saucer, with a handle. */
export function CoffeeMark() {
  return (
    <Frame>
      <path d="M4.6 7.4h9v4.1a3.4 3.4 0 0 1-3.4 3.4H8a3.4 3.4 0 0 1-3.4-3.4z" {...stroke} />
      <path d="M13.6 8.6h1.2a1.7 1.7 0 0 1 0 3.4h-1.2" {...stroke} />
      <path d="M3.2 16.4h11.6" {...stroke} />
    </Frame>
  );
}

/** A taller glass cup with a tea leaf steeping. */
export function TeaMark() {
  return (
    <Frame>
      <path d="M5.4 6.6h8l-.8 7.3a2.4 2.4 0 0 1-2.4 2.1H8.6a2.4 2.4 0 0 1-2.4-2.1z" {...stroke} />
      <path d="M9.4 13.4c-1.9-.5-2.6-2-2.3-3.9 1.9.4 2.7 2 2.3 3.9z" {...stroke} />
      <path d="M9.4 13.4c.4-1.4 1.2-2.4 2.3-3" {...stroke} />
      <path d="M10.6 4.6c0-.9-1.2-1-1.2-2" {...stroke} opacity="0.75" />
    </Frame>
  );
}

/** A plain tumbler, part filled. */
export function WaterMark() {
  return (
    <Frame>
      <path d="M6 4.2h8l-1 11.1a1.7 1.7 0 0 1-1.7 1.5H8.7A1.7 1.7 0 0 1 7 15.3z" {...stroke} />
      <path d="M6.5 9.6h7" {...stroke} opacity="0.7" />
    </Frame>
  );
}

export const DRINK_MARKS = {
  coffee: CoffeeMark,
  tea: TeaMark,
  water: WaterMark,
} as const;

/**
 * A compact cup for setting inline with text.
 *
 * The full `CoffeeMark` is drawn for a 20px slot beside a chip label: it stands
 * on a saucer, which pulls its ink low in its own box and leaves it sitting
 * below the line when it is set against running text. This one has no saucer,
 * is drawn to fill a smaller box, and is centred on its ink rather than on its
 * frame — so `align-items: center` actually lands it on the line.
 */
export function CoffeeMarkInline() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Ink spans 3.65 to 12.35, centred on the box's 8. */}
      <path d="M3.2 4.2h7.6v3.8a3.8 3.8 0 0 1-3.8 3.8A3.8 3.8 0 0 1 3.2 8z" {...stroke} />
      <path d="M10.8 5.6h1.1a1.6 1.6 0 0 1 0 3.2h-1.1" {...stroke} />
    </svg>
  );
}
