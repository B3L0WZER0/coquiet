import { describe, expect, it } from 'vitest';

import {
  BACKGROUND_SIZES,
  ROOMS,
  fallbackSrc,
  largestSrc,
  roomForHour,
  srcSet,
} from '@/lib/background';

const HOUR = 60 * 60 * 1000;

describe('the rooms', () => {
  it('has at least one, each with images and a focal point', () => {
    expect(ROOMS.length).toBeGreaterThan(0);
    for (const room of ROOMS) {
      expect(room.id).toMatch(/^[a-z0-9-]+$/);
      expect(room.widths.length).toBeGreaterThan(0);
      expect(room.lqip.startsWith('data:image/webp;base64,')).toBe(true);
      expect(room.focalX).toBeGreaterThanOrEqual(0);
      expect(room.focalX).toBeLessThanOrEqual(100);
    }
  });

  it('has a distinct id per room', () => {
    expect(new Set(ROOMS.map((r) => r.id)).size).toBe(ROOMS.length);
  });

  it('builds paths that point at the generated files', () => {
    for (const room of ROOMS) {
      expect(srcSet(room, 'avif')).toContain(`/images/${room.id}-${room.widths[0]}.avif ${room.widths[0]}w`);
      expect(largestSrc(room, 'avif')).toContain('.avif');
      expect(fallbackSrc(room)).toContain('.webp');
    }
    expect(BACKGROUND_SIZES).toContain('orientation: portrait');
  });
});

describe('choosing a room', () => {
  it('gives everyone the same room within the same hour', () => {
    const hourStart = Math.floor(1_700_000_000_000 / HOUR) * HOUR;
    // Two visitors arriving 59 minutes apart are still in the same room.
    expect(roomForHour(hourStart)).toBe(roomForHour(hourStart + HOUR - 1));
  });

  it('turns over on the hour', () => {
    const hourStart = Math.floor(1_700_000_000_000 / HOUR) * HOUR;
    expect(roomForHour(hourStart)).not.toBe(roomForHour(hourStart + HOUR));
  });

  it('visits every room before repeating', () => {
    const base = Math.floor(1_700_000_000_000 / HOUR) * HOUR;
    const seen = new Set(ROOMS.map((_, i) => roomForHour(base + i * HOUR).id));
    expect(seen.size).toBe(ROOMS.length);
  });

  it('stays inside the list for a clock before the epoch', () => {
    // Negative hour numbers must not index off the front of the array.
    expect(ROOMS).toContain(roomForHour(-5 * HOUR));
    expect(ROOMS).toContain(roomForHour(-1));
  });
});
