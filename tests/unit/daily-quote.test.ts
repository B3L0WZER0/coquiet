import { describe, expect, it } from 'vitest';

import { QUOTES, quoteOfTheDay, quoteShareText } from '@/lib/daily-quote';

const utc = (y: number, m: number, d: number, h = 12) => new Date(Date.UTC(y, m - 1, d, h));

describe('QUOTES', () => {
  it('covers at least three months without repeating', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(92);
    expect(new Set(QUOTES.map((q) => q.text)).size).toBe(QUOTES.length);
  });

  it('names an author and a source for every line', () => {
    for (const q of QUOTES) {
      expect(q.text.trim()).not.toBe('');
      expect(q.author.trim()).not.toBe('');
      expect(q.source.trim()).not.toBe('');
    }
  });

  it('never puts the same author on two days running', () => {
    for (let i = 0; i < QUOTES.length; i++) {
      expect(QUOTES[i].author).not.toBe(QUOTES[(i + 1) % QUOTES.length].author);
    }
  });
});

describe('quoteOfTheDay', () => {
  it('starts the list on 1 October 2026', () => {
    expect(quoteOfTheDay(utc(2026, 10, 1))).toBe(QUOTES[0]);
    expect(quoteOfTheDay(utc(2026, 10, 2))).toBe(QUOTES[1]);
  });

  it('is the same all through a UTC day', () => {
    expect(quoteOfTheDay(utc(2026, 11, 5, 0))).toBe(quoteOfTheDay(utc(2026, 11, 5, 23)));
  });

  it('comes round again after the last line, and works before the start', () => {
    expect(quoteOfTheDay(new Date(utc(2026, 10, 1).getTime() + QUOTES.length * 86_400_000))).toBe(QUOTES[0]);
    expect(quoteOfTheDay(utc(2026, 9, 30))).toBe(QUOTES[QUOTES.length - 1]);
  });
});

describe('quoteShareText', () => {
  it('is the line and its author, nothing else', () => {
    expect(quoteShareText({ text: 'Simplify, simplify.', author: 'Henry David Thoreau', source: 'Walden, 1854' })).toBe(
      '“Simplify, simplify.” — Henry David Thoreau',
    );
  });
});
