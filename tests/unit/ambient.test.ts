import { describe, expect, it } from 'vitest';

import { AMBIENT_SCENES, getScene, isAmbientId } from '@/lib/ambient';
import {
  AMBIENT_CHANNELS,
  CHANNELS,
  getChannel,
  isChannelId,
  isMusicChannelId,
  modeOf,
} from '@/lib/channels';

describe('the Ambient room', () => {
  it('has three scenes, Blue, Green and White, in that order', () => {
    expect(AMBIENT_SCENES.map((s) => [s.id, s.label])).toEqual([
      ['coast', 'Blue'],
      ['forest', 'Green'],
      ['snow', 'White'],
    ]);
  });

  it('gives each scene one looping track, served with the site rather than from /audio', () => {
    for (const channel of AMBIENT_CHANNELS) {
      expect(channel.kind).toBe('ambient');
      expect(channel.tracks).toHaveLength(1);
      expect(channel.tracks[0].src).toMatch(new RegExp(`/ambient/${channel.id}\\.m4a$`));
      expect(channel.durationSeconds).toBeGreaterThan(60);
    }
  });

  it('keeps the music selector to the three music channels', () => {
    expect(CHANNELS.map((c) => c.id)).toEqual(['still', 'flow', 'momentum']);
    expect(CHANNELS.every((c) => c.kind === 'music')).toBe(true);
  });

  it('tells the two rooms apart by channel', () => {
    expect(modeOf('flow')).toBe('music');
    expect(modeOf('snow')).toBe('ambient');
    expect(isChannelId('forest')).toBe(true);
    expect(isMusicChannelId('forest')).toBe(false);
    expect(isAmbientId('flow')).toBe(false);
    expect(getChannel('coast').label).toBe('Blue');
    expect(getScene('forest').sound).toBe('Forest birdsong');
  });
});
