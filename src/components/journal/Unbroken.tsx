/** A title whose hyphenated words never split at the hyphen ("one-" / "line"). */
export function Unbroken({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((word, i) => (
        <span key={i}>
          {word.includes('-') ? <span style={{ whiteSpace: 'nowrap' }}>{word}</span> : word}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}
