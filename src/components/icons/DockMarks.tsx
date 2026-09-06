/** Line marks for the mobile dock triggers. Same weight and frame as the
 *  activity and drink marks so the bottom bar reads as one set. */

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

/** Two beamed notes — the music channel. */
export function NoteMark() {
  return (
    <Frame>
      <path d="M7.4 13.2V5l7.2-1.6v7" {...stroke} />
      <ellipse cx="5.7" cy="13.4" rx="1.9" ry="1.5" {...stroke} />
      <ellipse cx="12.7" cy="11.6" rx="1.9" ry="1.5" {...stroke} />
    </Frame>
  );
}

/** A clock face — the focus timer. */
export function ClockMark() {
  return (
    <Frame>
      <circle cx="10" cy="10" r="6.4" {...stroke} />
      <path d="M10 6.3V10l2.6 1.6" {...stroke} />
    </Frame>
  );
}

/** A single figure — your own presence. */
export function PersonMark() {
  return (
    <Frame>
      <circle cx="10" cy="6.7" r="2.7" {...stroke} />
      <path d="M4.8 15.6a5.2 5.2 0 0 1 10.4 0" {...stroke} />
    </Frame>
  );
}

/** Two figures — the rest of the room. Three heads crowded into 20px read as
 *  a smudge beside the single-stroke marks either side of it; two stand
 *  apart. */
export function PeopleMark() {
  return (
    <Frame>
      <circle cx="8" cy="7.2" r="2.7" {...stroke} />
      <path d="M2.9 15.6a5.1 5.1 0 0 1 10.2 0" {...stroke} />
      <circle cx="14.9" cy="6.4" r="2" {...stroke} />
      <path d="M15.1 11a4.3 4.3 0 0 1 3.3 4.6" {...stroke} />
    </Frame>
  );
}
