import { describe, expect, it } from 'vitest';

import {
  FEATURE_REQUEST_EMAIL,
  FEATURE_REQUEST_SUBJECT,
  RELEASES,
  VERSION,
  featureRequestDraft,
  noteText,
} from '@/lib/release';

/** What the visitor's mail app will actually read back out of the link. */
function parse(href: string) {
  const url = new URL(href);
  const q = new URLSearchParams(url.search);
  return { to: url.pathname, subject: q.get('subject'), body: q.get('body') };
}

describe('the panel contents', () => {
  it('lists exactly two releases, newest first, each with notes', () => {
    expect(RELEASES).toHaveLength(2);
    expect(RELEASES[0].version).toBe(VERSION);
    for (const release of RELEASES) {
      expect(release.notes.length).toBeGreaterThan(0);
      expect(release.date).not.toBe('');
      for (const note of release.notes) {
        expect(noteText(note).trim()).not.toBe('');
        // A linked phrase that isn't in its note would silently render unlinked.
        if (typeof note !== 'string' && note.link) expect(note.text).toContain(note.link.phrase);
      }
    }
  });
});

describe('the mail draft', () => {
  it('addresses the request inbox and carries both fields', () => {
    const draft = parse(featureRequestDraft('A longer break', 'Five minutes is short.'));
    expect(draft.to).toBe(FEATURE_REQUEST_EMAIL);
    expect(draft.subject).toBe('A longer break');
    expect(draft.body).toBe('Five minutes is short.');
  });

  it('falls back to a subject rather than sending a blank one', () => {
    expect(parse(featureRequestDraft('   ', 'Anything at all.')).subject).toBe(
      FEATURE_REQUEST_SUBJECT,
    );
  });

  it('trims, so a stray newline does not become the subject', () => {
    const draft = parse(featureRequestDraft('  Dark mode \n', '\n  Please.  \n'));
    expect(draft.subject).toBe('Dark mode');
    expect(draft.body).toBe('Please.');
  });

  it('survives the characters people actually type', () => {
    // Spaces are encoded as "+" by URLSearchParams and swapped back to %20, so
    // a "+" the visitor typed has to come out the other side unharmed.
    const body = 'Line one.\nLine two — with C++, 50% & a question?';
    const draft = parse(featureRequestDraft('Tabs + spaces', body));
    expect(draft.subject).toBe('Tabs + spaces');
    expect(draft.body).toBe(body);
    // No literal "+" left standing in for a space anywhere in the link.
    expect(featureRequestDraft('a b', 'c d')).not.toContain('+');
  });
});
