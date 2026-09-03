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
