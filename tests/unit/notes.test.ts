import { describe, expect, it } from 'vitest';

import {
  BREAK_SUGGESTIONS,
  FOCUS_NOTES,
  MAX_NOTE_LENGTH,
  breakSuggestion,
  globalHour,
  noteForHour,
} from '@/lib/notes';

const HOUR = 60 * 60 * 1000;

describe('the collection', () => {
  it('is large enough not to repeat within a sitting', () => {
    // An hourly rotation through twelve notes came round twice a day.
    expect(FOCUS_NOTES.length).toBeGreaterThanOrEqual(50);
    const daysBeforeRepeat = FOCUS_NOTES.length / 24;
    expect(daysBeforeRepeat).toBeGreaterThan(2);
  });

  it('has no duplicates', () => {
    expect(new Set(FOCUS_NOTES).size).toBe(FOCUS_NOTES.length);
    expect(new Set(BREAK_SUGGESTIONS).size).toBe(BREAK_SUGGESTIONS.length);
  });

  it('keeps every note short enough for the room to show it', () => {
    for (const note of [...FOCUS_NOTES, ...BREAK_SUGGESTIONS]) {
      expect(note.length, note).toBeLessThanOrEqual(MAX_NOTE_LENGTH);
      expect(note.trim(), note).toBe(note);
      expect(note.length).toBeGreaterThan(0);
    }
  });

  it('never shouts, and never quotes anyone', () => {
    for (const note of [...FOCUS_NOTES, ...BREAK_SUGGESTIONS]) {
      expect(note, note).not.toContain('!');
      // A quotation mark or a dash-attribution would mean it came from someone.
      expect(note, note).not.toMatch(/["“”]/);
      expect(note, note).not.toMatch(/\s[—-]\s*[A-Z][a-z]+\s+[A-Z]/);
    }
  });
});

describe('choosing a note', () => {
  it('gives everyone the same note within the same hour', () => {
    const start = 1_700_000_000_000;
    const hourStart = Math.floor(start / HOUR) * HOUR;
    expect(noteForHour(hourStart)).toBe(noteForHour(hourStart + HOUR - 1));
  });

  it('changes on the hour boundary', () => {
    const hourStart = Math.floor(1_700_000_000_000 / HOUR) * HOUR;
    expect(noteForHour(hourStart)).not.toBe(noteForHour(hourStart + HOUR));
  });

  it('walks the whole collection before repeating', () => {
    const base = Math.floor(1_700_000_000_000 / HOUR) * HOUR;
    const seen = new Set<string>();
    for (let i = 0; i < FOCUS_NOTES.length; i++) seen.add(noteForHour(base + i * HOUR));
    expect(seen.size).toBe(FOCUS_NOTES.length);
  });

  it('is stable for a clock before the epoch', () => {
    // Negative hour numbers must still land inside the collection.
    expect(FOCUS_NOTES).toContain(noteForHour(-5 * HOUR));
    expect(globalHour(-5 * HOUR)).toBeLessThan(0);
  });
});

describe('break suggestions', () => {
  it('changes with each break', () => {
    const now = 1_700_000_000_000;
    expect(breakSuggestion(0, now)).not.toBe(breakSuggestion(1, now));
    expect(breakSuggestion(1, now)).not.toBe(breakSuggestion(2, now));
  });

  it('always returns one of the list', () => {
    for (let i = 0; i < 40; i++) {
      expect(BREAK_SUGGESTIONS).toContain(breakSuggestion(i, 1_700_000_000_000));
    }
  });
});
