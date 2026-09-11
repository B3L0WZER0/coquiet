/** An open book: the journal's mark, drawn like the drink and activity marks. */
export function BookMark() {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.1,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 5.6C8.4 4.4 6.1 4 3.4 4.2v10.6c2.7-.2 5 .2 6.6 1.4 1.6-1.2 3.9-1.6 6.6-1.4V4.2C13.9 4 11.6 4.4 10 5.6z" {...stroke} />
      <path d="M10 5.6v10.6" {...stroke} />
    </svg>
  );
}
