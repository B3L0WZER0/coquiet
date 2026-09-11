/** The journal's two small arrows: onward (↗) and back (←). */
export function ArrowUpRight() {
  return (
    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 11 11" fill="none" className="journal-arrow">
      <path d="M2.5 8.5 8.5 2.5m0 0H3.5m5 0v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowLeft() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" className="journal-arrow">
      <path d="M10 6H2m0 0 3.5-3.5M2 6l3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
