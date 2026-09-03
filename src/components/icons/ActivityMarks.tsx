/** Line marks for the four activities. */

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

/** A laptop: screen above, base below. */
export function WorkingMark() {
  return (
    <Frame>
      <rect x="5" y="4.6" width="10" height="7.8" rx="1" {...stroke} />
      <path d="M5 12.4 3.4 14.9h13.2L15 12.4" {...stroke} />
    </Frame>
  );
}

/** A sheet of notes. */
export function StudyingMark() {
  return (
    <Frame>
      <rect x="5.2" y="3.6" width="9.6" height="12.8" rx="1.2" {...stroke} />
      <path d="M7.6 7.4h4.8M7.6 10h4.8M7.6 12.6h3.1" {...stroke} />
    </Frame>
  );
}

/** An open book, spine down the middle. */
export function ReadingMark() {
  return (
    <Frame>
      <path d="M10 6.6v9" {...stroke} />
      <path d="M10 6.6C8.6 5.5 6.7 5.1 4.3 5.4v8.8c2.4-.3 4.3.1 5.7 1.2" {...stroke} />
      <path d="M10 6.6c1.4-1.1 3.3-1.5 5.7-1.2v8.8c-2.4-.3-4.3.1-5.7 1.2" {...stroke} />
    </Frame>
  );
}

/** A pen nib. */
export function CreatingMark() {
  return (
    <Frame>
      <path d="M6.6 4.2h6.8v6.4L10 15.8 6.6 10.6z" {...stroke} />
      <path d="M10 11.6v2.6" {...stroke} />
      <circle cx="10" cy="9.1" r="0.95" {...stroke} />
    </Frame>
  );
}

export const ACTIVITY_MARKS = {
  working: WorkingMark,
  studying: StudyingMark,
  reading: ReadingMark,
  creating: CreatingMark,
} as const;
