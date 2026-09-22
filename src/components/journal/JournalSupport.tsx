import { CoffeeMarkSteaming } from '@/components/icons/DrinkMarks';
import { SUPPORT_URL } from '@/lib/support';

/**
 * The one place the journal asks for anything: a line in gold at the foot of a
 * post, and a quieter one under the index. Never a banner, never a modal.
 */
export function JournalSupport({ variant = 'post' }: { variant?: 'post' | 'index' }) {
  if (!SUPPORT_URL) return null;

  return (
    <p className={`journal-support journal-support-${variant}`}>
      <span className="journal-support-mark" aria-hidden="true">
        <CoffeeMarkSteaming />
      </span>
      {variant === 'post'
        ? 'If this one helped, or landed at the right moment — you can '
        : 'Coquiet is quiet, free and ad-free. If it helps your days, you can '}
      <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="journal-support-link">
        buy us a coffee
      </a>
      {variant === 'post'
        ? '. It goes straight into making Coquiet better.'
        : ' — it goes straight into making it better.'}
    </p>
  );
}
