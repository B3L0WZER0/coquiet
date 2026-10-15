import { describe, expect, it } from 'vitest';

import { channelsFor, getChannel, isMusicChannelId, JAZZ_CHANNELS, modeOf } from '@/lib/channels';
import { JAZZ_SCENES, jazzSceneForHour } from '@/lib/jazz';
import { ROOMS } from '@/lib/background';

const HOUR = 60 * 60 * 1000;

describe('the Jazz room', () => {
  it('plays one channel, its own room, and offers nothing to switch to', () => {
    expect(JAZZ_CHANNELS.map((c) => c.id)).toEqual(['jazz']);
    expect(channelsFor('jazz')).toBe(JAZZ_CHANNELS);
    expect(modeOf('jazz')).toBe('jazz');
    expect(isMusicChannelId('jazz')).toBe(false);
  });

  it('runs its programme from the five mixes, in order', () => {
    const jazz = getChannel('jazz');
    expect(jazz.tracks.map((t) => decodeURIComponent(t.src).replace(/^.*\//, ''))).toEqual([
      'Jazz 1.m4a',
      'Jazz 2.m4a',
      'Jazz 3.m4a',
      'Jazz 4.m4a',
      'Jazz 5.m4a',
    ]);
    // Five long mixes: comfortably more than a working day.
    expect(jazz.durationSeconds).toBeGreaterThan(5 * 3600);
  });

  it('changes scene with the hour, through all four, and keeps them out of the Music rooms', () => {
    expect(JAZZ_SCENES).toHaveLength(4);
    const base = Date.UTC(2026, 9, 15, 0, 30);
    const seen = new Set([0, 1, 2, 3].map((h) => jazzSceneForHour(base + h * HOUR).id));
    expect(seen.size).toBe(4);
    expect(jazzSceneForHour(base).id).toBe(jazzSceneForHour(base + 4 * HOUR).id);
    expect(ROOMS.some((r) => r.id.startsWith('jazz-'))).toBe(false);
  });
});
